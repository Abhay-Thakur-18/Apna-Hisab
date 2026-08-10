from bson import ObjectId
from datetime import datetime, timezone
from fastapi import HTTPException, status
from app.core.database import get_db
from app.schemas.transaction import TransactionCreate, PaymentCreate, TransactionUpdate
from app.utils.serialize import serialize_doc

async def create_transaction(user_id: str, tx_in: TransactionCreate) -> dict:
    """
    Creates a new transaction, validating status and computing paid/pending amounts.
    """
    db = get_db()
    
    # Deduplicate check for offline-first idempotency
    if tx_in.client_ref_id:
        existing = await db.transactions.find_one({
            "user_id": ObjectId(user_id),
            "client_ref_id": tx_in.client_ref_id
        })
        if existing:
            return serialize_doc(existing)
            
    amount = tx_in.amount
    tx_type = tx_in.type.lower()
    tx_status = tx_in.status.lower()
    
    if tx_type not in ["income", "expense"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transaction type must be 'income' or 'expense'."
        )
        
    if tx_status not in ["paid", "pending", "partially_paid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transaction status must be 'paid', 'pending', or 'partially_paid'."
        )
        
    # Calculate paid and pending amounts based on status
    if tx_status == "paid":
        paid_amount = amount
        pending_amount = 0
    elif tx_status == "pending":
        paid_amount = 0
        pending_amount = amount
    else:  # partially_paid
        requested_paid = tx_in.paid_amount or 0
        if requested_paid <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paid amount must be greater than 0 for partially paid transactions."
            )
        if requested_paid >= amount:
            tx_status = "paid"
            paid_amount = amount
            pending_amount = 0
        else:
            paid_amount = requested_paid
            pending_amount = amount - paid_amount

    # Resolve Khata ID if present
    khata_oid = None
    if tx_in.khata_id:
        try:
            khata_oid = ObjectId(tx_in.khata_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Khata Account ID format."
            )

    # If Khata ID is provided, verify the account exists and belongs to the user
    if khata_oid:
        khata_acc = await db.khata_accounts.find_one({"_id": khata_oid, "user_id": ObjectId(user_id)})
        if not khata_acc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated Khata Account not found."
            )

    transaction_doc = {
        "user_id": ObjectId(user_id),
        "amount": amount,
        "paid_amount": paid_amount,
        "pending_amount": pending_amount,
        "type": tx_type,
        "status": tx_status,
        "category": tx_in.category,
        "subcategory": tx_in.subcategory,
        "payment_method": tx_in.payment_method,
        "date": tx_in.date,
        "time": tx_in.time,
        "description": tx_in.description,
        "khata_id": khata_oid,
        "khata_type": tx_in.khata_type,
        "recurring_id": None,
        "client_ref_id": tx_in.client_ref_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.transactions.insert_one(transaction_doc)
    transaction_doc["_id"] = result.inserted_id
    
    return serialize_doc(transaction_doc)

async def record_payment(user_id: str, payment_in: PaymentCreate) -> dict:
    """
    Records a full or partial payment against a pending or partially paid transaction.
    Reduces the transaction pending amount and increases the paid amount.
    """
    db = get_db()
    
    # Deduplicate check for offline-first idempotency
    if payment_in.client_ref_id:
        existing = await db.payments.find_one({
            "user_id": ObjectId(user_id),
            "client_ref_id": payment_in.client_ref_id
        })
        if existing:
            return serialize_doc(existing)
    
    try:
        tx_oid = ObjectId(payment_in.transaction_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Transaction ID format."
        )
        
    transaction = await db.transactions.find_one({"_id": tx_oid, "user_id": ObjectId(user_id)})
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_444_NOT_FOUND if hasattr(status, "HTTP_444_NOT_FOUND") else 404,
            detail="Transaction not found or unauthorized access."
        )
        
    if transaction["status"] == "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transaction is already fully paid."
        )
        
    outstanding = transaction["pending_amount"]
    pay_amount = payment_in.amount
    
    if pay_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount must be positive."
        )
        
    if pay_amount > outstanding:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment amount ({pay_amount}) exceeds the outstanding pending amount ({outstanding})."
        )
        
    # Create the payment document
    payment_doc = {
        "user_id": ObjectId(user_id),
        "khata_id": transaction.get("khata_id"),
        "transaction_id": tx_oid,
        "amount": pay_amount,
        "payment_method": payment_in.payment_method,
        "date": payment_in.date,
        "time": payment_in.time,
        "description": payment_in.description,
        "client_ref_id": payment_in.client_ref_id,
        "created_at": datetime.now(timezone.utc)
    }
    
    payment_res = await db.payments.insert_one(payment_doc)
    payment_doc["_id"] = payment_res.inserted_id
    
    # Calculate new transaction status and amounts
    new_paid = transaction["paid_amount"] + pay_amount
    new_pending = transaction["amount"] - new_paid
    new_status = "paid" if new_pending == 0 else "partially_paid"
    
    await db.transactions.update_one(
        {"_id": tx_oid},
        {
            "$set": {
                "paid_amount": new_paid,
                "pending_amount": new_pending,
                "status": new_status,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return serialize_doc(payment_doc)

async def update_transaction(user_id: str, tx_id: str, tx_update: TransactionUpdate) -> dict:
    """
    Updates an existing transaction, validating inputs and recalculating paid/pending amounts.
    """
    db = get_db()
    try:
        tx_oid = ObjectId(tx_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Transaction ID format."
        )
        
    transaction = await db.transactions.find_one({"_id": tx_oid, "user_id": ObjectId(user_id)})
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found or unauthorized access."
        )

    update_data = {}
    amount = tx_update.amount if tx_update.amount is not None else transaction["amount"]
    status_val = tx_update.status.lower() if tx_update.status is not None else transaction["status"]
    
    if tx_update.type is not None:
        tx_type = tx_update.type.lower()
        if tx_type not in ["income", "expense"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaction type must be 'income' or 'expense'."
            )
        update_data["type"] = tx_type
    else:
        tx_type = transaction["type"]

    if status_val == "paid":
        paid_amount = amount
        pending_amount = 0
    elif status_val == "pending":
        paid_amount = 0
        pending_amount = amount
    elif status_val == "partially_paid":
        if tx_update.paid_amount is not None:
            paid_amount = tx_update.paid_amount
        else:
            paid_amount = transaction.get("paid_amount", 0) if transaction["status"] == "partially_paid" else 0
            
        if paid_amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paid amount must be greater than 0 for partially paid transactions."
            )
        if paid_amount >= amount:
            status_val = "paid"
            paid_amount = amount
            pending_amount = 0
        else:
            pending_amount = amount - paid_amount
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transaction status must be 'paid', 'pending', or 'partially_paid'."
        )

    update_data["amount"] = amount
    update_data["status"] = status_val
    update_data["paid_amount"] = paid_amount
    update_data["pending_amount"] = pending_amount

    if tx_update.category is not None:
        update_data["category"] = tx_update.category
    if tx_update.subcategory is not None:
        update_data["subcategory"] = tx_update.subcategory
    if tx_update.payment_method is not None:
        update_data["payment_method"] = tx_update.payment_method
    if tx_update.date is not None:
        update_data["date"] = tx_update.date
    if tx_update.time is not None:
        update_data["time"] = tx_update.time
    if tx_update.description is not None:
        update_data["description"] = tx_update.description

    if tx_update.khata_id is not None:
        if tx_update.khata_id == "" or tx_update.khata_id is None:
            update_data["khata_id"] = None
        else:
            try:
                khata_oid = ObjectId(tx_update.khata_id)
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid Khata Account ID format."
                )
            khata_acc = await db.khata_accounts.find_one({"_id": khata_oid, "user_id": ObjectId(user_id)})
            if not khata_acc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Associated Khata Account not found."
                )
            update_data["khata_id"] = khata_oid

    update_data["updated_at"] = datetime.now(timezone.utc)

    await db.transactions.update_one({"_id": tx_oid}, {"$set": update_data})
    
    updated_doc = await db.transactions.find_one({"_id": tx_oid})
    return serialize_doc(updated_doc)

