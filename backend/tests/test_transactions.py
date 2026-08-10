import pytest
from fastapi import HTTPException
from app.schemas.transaction import TransactionCreate, PaymentCreate, TransactionUpdate
from app.services.transaction_service import create_transaction, record_payment, update_transaction
from app.core.database import get_db
from bson import ObjectId

USER_A = "60c72b2f9b1d8e25d88f6c4e"
USER_B = "60c72b2f9b1d8e25d88f6c4f"

@pytest.mark.asyncio
async def test_create_transaction_paid(clear_collections):
    # Test recording a fully paid transaction
    tx_in = TransactionCreate(
        amount=8000, # ₹80.00
        type="expense",
        status="paid",
        category="Food",
        subcategory="Tiffin",
        payment_method="UPI",
        date="2026-08-09",
        time="12:00:00",
        description="Lunch tiffin"
    )
    tx = await create_transaction(USER_A, tx_in)
    
    assert tx["amount"] == 8000
    assert tx["paid_amount"] == 8000
    assert tx["pending_amount"] == 0
    assert tx["status"] == "paid"
    assert tx["user_id"] == USER_A

@pytest.mark.asyncio
async def test_create_transaction_pending(clear_collections):
    # Test recording a fully pending transaction (Khata)
    tx_in = TransactionCreate(
        amount=200000, # ₹2,000.00
        type="expense",
        status="pending",
        category="Rent",
        subcategory="Room",
        payment_method="None",
        date="2026-08-09",
        time="12:00:00"
    )
    tx = await create_transaction(USER_A, tx_in)
    
    assert tx["amount"] == 200000
    assert tx["paid_amount"] == 0
    assert tx["pending_amount"] == 200000
    assert tx["status"] == "pending"

@pytest.mark.asyncio
async def test_user_data_isolation(clear_collections):
    # Test that USER B cannot access USER A's data or pay off A's transactions
    tx_in = TransactionCreate(
        amount=5000,
        type="expense",
        status="pending",
        category="Travel",
        subcategory="Cab",
        payment_method="None",
        date="2026-08-09",
        time="12:00:00"
    )
    tx = await create_transaction(USER_A, tx_in)
    
    # USER B tries to record a payment against USER A's transaction
    pay_in = PaymentCreate(
        transaction_id=tx["id"],
        amount=2500,
        payment_method="UPI",
        date="2026-08-09",
        time="12:30:00"
    )
    
    with pytest.raises(HTTPException) as exc_info:
        await record_payment(USER_B, pay_in)
        
    assert exc_info.value.status_code == 404 # Not found or unauthorized

@pytest.mark.asyncio
async def test_offline_idempotency_deduplication(clear_collections):
    # Test that duplicate submissions of transactions with same client_ref_id are filtered
    ref_id = "client-tx-uuid-999"
    tx_in = TransactionCreate(
        amount=8000,
        type="expense",
        status="paid",
        category="Food",
        subcategory="Tiffin",
        payment_method="UPI",
        date="2026-08-09",
        time="12:00:00",
        client_ref_id=ref_id
    )
    
    # Submit first time
    tx1 = await create_transaction(USER_A, tx_in)
    
    # Submit second time (duplicate retry)
    tx2 = await create_transaction(USER_A, tx_in)
    
    assert tx1["id"] == tx2["id"]
    
    # Verify only one document exists in DB
    db = get_db()
    count = await db.transactions.count_documents({"client_ref_id": ref_id})
    assert count == 1

@pytest.mark.asyncio
async def test_partial_and_full_payment_flow(clear_collections):
    # Create pending transaction of ₹2,000
    tx_in = TransactionCreate(
        amount=200000,
        type="expense",
        status="pending",
        category="Rent",
        subcategory="Room",
        payment_method="None",
        date="2026-08-09",
        time="12:00:00"
    )
    tx = await create_transaction(USER_A, tx_in)
    tx_id = tx["id"]
    
    # Pay ₹1,000 (Partial Payment 1)
    pay_in = PaymentCreate(
        transaction_id=tx_id,
        amount=100000,
        payment_method="UPI",
        date="2026-08-09",
        time="12:05:00"
    )
    pay1 = await record_payment(USER_A, pay_in)
    
    # Verify status in database
    db = get_db()
    updated_tx = await db.transactions.find_one({"_id": ObjectId(tx_id)})
    assert updated_tx["paid_amount"] == 100000
    assert updated_tx["pending_amount"] == 100000
    assert updated_tx["status"] == "partially_paid"
    
    # Pay remaining ₹1,000 (Full Payment 2)
    pay_in_final = PaymentCreate(
        transaction_id=tx_id,
        amount=100000,
        payment_method="Cash",
        date="2026-08-09",
        time="12:10:00"
    )
    pay2 = await record_payment(USER_A, pay_in_final)
    
    # Verify final status
    updated_tx_final = await db.transactions.find_one({"_id": ObjectId(tx_id)})
    assert updated_tx_final["paid_amount"] == 200000
    assert updated_tx_final["pending_amount"] == 0
    assert updated_tx_final["status"] == "paid"
    
    # Verify error if user tries to pay more
    pay_in_invalid = PaymentCreate(
        transaction_id=tx_id,
        amount=50000,
        payment_method="UPI",
        date="2026-08-09",
        time="12:15:00"
    )
    with pytest.raises(HTTPException) as exc_info:
        await record_payment(USER_A, pay_in_invalid)
    assert exc_info.value.status_code == 400

@pytest.mark.asyncio
async def test_update_transaction(clear_collections):
    # Create transaction
    tx_in = TransactionCreate(
        amount=5000,
        type="expense",
        status="pending",
        category="Travel",
        subcategory="Cab",
        payment_method="None",
        date="2026-08-09",
        time="12:00:00"
    )
    tx = await create_transaction(USER_A, tx_in)
    
    # Update category, amount, status
    tx_update = TransactionUpdate(
        amount=6000,
        status="paid",
        category="Transport",
        payment_method="Cash"
    )
    updated = await update_transaction(USER_A, tx["id"], tx_update)
    
    assert updated["amount"] == 6000
    assert updated["status"] == "paid"
    assert updated["category"] == "Transport"
    assert updated["payment_method"] == "Cash"
    assert updated["paid_amount"] == 6000
    assert updated["pending_amount"] == 0
    
    # Verify User B cannot edit USER A's transaction
    with pytest.raises(HTTPException) as exc_info:
        await update_transaction(USER_B, tx["id"], tx_update)
    assert exc_info.value.status_code == 404

