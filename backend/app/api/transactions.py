from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from datetime import datetime, timezone
from typing import List, Optional
from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.schemas.transaction import (
    TransactionCreate, TransactionResponse, 
    PaymentCreate, PaymentResponse
)
from app.services.transaction_service import create_transaction, record_payment
from app.utils.serialize import serialize_doc, serialize_list

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def add_transaction(tx: TransactionCreate, current_user: dict = Depends(get_current_user)):
    return await create_transaction(current_user["id"], tx)

@router.post("/payment", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def make_payment(payment: PaymentCreate, current_user: dict = Depends(get_current_user)):
    return await record_payment(current_user["id"], payment)

@router.get("", response_model=List[TransactionResponse])
async def list_transactions(
    type: Optional[str] = Query(None, regex="^(income|expense)$"),
    status: Optional[str] = Query(None, regex="^(paid|pending|partially_paid)$"),
    category: Optional[str] = None,
    khata_id: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    # Base filter: isolate by current user
    filters = {"user_id": ObjectId(current_user["id"])}
    
    if type:
        filters["type"] = type
    if status:
        filters["status"] = status
    if category:
        filters["category"] = category
        
    if khata_id:
        try:
            filters["khata_id"] = ObjectId(khata_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid Khata Account ID format.")
            
    # Date range filters (YYYY-MM-DD)
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        filters["date"] = date_filter
        
    # Text search on description, category, and subcategory
    if search:
        filters["$or"] = [
            {"description": {"$regex": search, "$options": "i"}},
            {"category": {"$regex": search, "$options": "i"}},
            {"subcategory": {"$regex": search, "$options": "i"}}
        ]
        
    cursor = db.transactions.find(filters).sort([("date", -1), ("time", -1)]).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    
    return serialize_list(docs)

@router.get("/{id}", response_model=TransactionResponse)
async def get_transaction(id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Transaction ID format.")
        
    doc = await db.transactions.find_one({"_id": oid, "user_id": ObjectId(current_user["id"])})
    if not doc:
        raise HTTPException(status_code=404, detail="Transaction not found.")
        
    return serialize_doc(doc)

@router.delete("/{id}", status_code=status.HTTP_200_OK)
async def delete_transaction(id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Transaction ID format.")
        
    doc = await db.transactions.find_one({"_id": oid, "user_id": ObjectId(current_user["id"])})
    if not doc:
        raise HTTPException(status_code=404, detail="Transaction not found.")
        
    # Cascading delete: clean up any payments associated with this transaction
    await db.payments.delete_many({"transaction_id": oid})
    
    # Delete the transaction
    await db.transactions.delete_one({"_id": oid})
    
    return {"message": "Transaction and all associated payments successfully deleted."}
