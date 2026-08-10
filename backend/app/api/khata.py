from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime, timezone
from typing import List
from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.schemas.transaction import KhataAccountCreate, KhataAccountResponse, TransactionResponse
from app.utils.serialize import serialize_doc, serialize_list

router = APIRouter(prefix="/api/khata", tags=["Khata (Ledger)"])

@router.post("", response_model=KhataAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_khata_account(
    account: KhataAccountCreate, 
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    # Deduplicate check for offline-first idempotency
    if account.client_ref_id:
        existing = await db.khata_accounts.find_one({
            "user_id": ObjectId(current_user["id"]),
            "client_ref_id": account.client_ref_id
        })
        if existing:
            res = serialize_doc(existing)
            # Calculate stats for this specific account
            pipeline = [
                {"$match": {"user_id": ObjectId(current_user["id"]), "khata_id": existing["_id"]}},
                {"$group": {
                    "_id": "$khata_id",
                    "total_pending": {"$sum": "$pending_amount"},
                    "total_paid": {"$sum": "$paid_amount"}
                }}
            ]
            agg_cursor = db.transactions.aggregate(pipeline)
            stats = await agg_cursor.to_list(length=1)
            stat = stats[0] if stats else {"total_pending": 0, "total_paid": 0}
            
            res["total_pending"] = stat["total_pending"]
            res["total_paid"] = stat["total_paid"]
            res["outstanding"] = stat["total_pending"]
            return res

    # Check if a khata account with the same name already exists for the user
    existing_name = await db.khata_accounts.find_one({
        "user_id": ObjectId(current_user["id"]),
        "name": {"$regex": f"^{account.name}$", "$options": "i"}
    })
    
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A Khata account with this name already exists."
        )
        
    account_doc = {
        "user_id": ObjectId(current_user["id"]),
        "name": account.name,
        "description": account.description,
        "client_ref_id": account.client_ref_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.khata_accounts.insert_one(account_doc)
    account_doc["_id"] = result.inserted_id
    
    # Return with default calculations
    res = serialize_doc(account_doc)
    res["total_pending"] = 0
    res["total_paid"] = 0
    res["outstanding"] = 0
    
    return res

@router.get("", response_model=List[KhataAccountResponse])
async def list_khata_accounts(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = ObjectId(current_user["id"])
    
    # 1. Fetch all accounts
    cursor = db.khata_accounts.find({"user_id": user_id}).sort("name", 1)
    accounts = await cursor.to_list(length=100)
    
    if not accounts:
        return []
        
    # 2. Query stats using aggregation pipeline on transactions
    pipeline = [
        {"$match": {"user_id": user_id, "khata_id": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$khata_id",
            "total_pending": {"$sum": "$pending_amount"},
            "total_paid": {"$sum": "$paid_amount"}
        }}
    ]
    
    agg_cursor = db.transactions.aggregate(pipeline)
    stats_list = await agg_cursor.to_list(length=200)
    stats_map = {str(stat["_id"]): stat for stat in stats_list}
    
    # 3. Assemble response
    response_list = []
    for acc in accounts:
        acc_id = str(acc["_id"])
        stat = stats_map.get(acc_id, {"total_pending": 0, "total_paid": 0})
        
        serialized = serialize_doc(acc)
        serialized["total_pending"] = stat["total_pending"]
        serialized["total_paid"] = stat["total_paid"]
        serialized["outstanding"] = stat["total_pending"]
        response_list.append(serialized)
        
    return response_list

@router.get("/{id}", response_model=KhataAccountResponse)
async def get_khata_account(id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Khata Account ID format.")
        
    account = await db.khata_accounts.find_one({"_id": oid, "user_id": ObjectId(current_user["id"])})
    if not account:
        raise HTTPException(status_code=404, detail="Khata account not found.")
        
    # Calculate stats for this specific account
    pipeline = [
        {"$match": {"user_id": ObjectId(current_user["id"]), "khata_id": oid}},
        {"$group": {
            "_id": "$khata_id",
            "total_pending": {"$sum": "$pending_amount"},
            "total_paid": {"$sum": "$paid_amount"}
        }}
    ]
    
    agg_cursor = db.transactions.aggregate(pipeline)
    stats = await agg_cursor.to_list(length=1)
    
    stat = stats[0] if stats else {"total_pending": 0, "total_paid": 0}
    
    serialized = serialize_doc(account)
    serialized["total_pending"] = stat["total_pending"]
    serialized["total_paid"] = stat["total_paid"]
    serialized["outstanding"] = stat["total_pending"]
    
    return serialized

@router.get("/{id}/transactions", response_model=List[TransactionResponse])
async def get_khata_transactions(id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Khata Account ID format.")
        
    # Verify account exists
    account = await db.khata_accounts.find_one({"_id": oid, "user_id": ObjectId(current_user["id"])})
    if not account:
        raise HTTPException(status_code=404, detail="Khata account not found.")
        
    cursor = db.transactions.find({"khata_id": oid}).sort([("date", -1), ("time", -1)])
    docs = await cursor.to_list(length=200)
    
    return serialize_list(docs)

@router.delete("/{id}", status_code=status.HTTP_200_OK)
async def delete_khata_account(id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Khata Account ID format.")
        
    account = await db.khata_accounts.find_one({"_id": oid, "user_id": ObjectId(current_user["id"])})
    if not account:
        raise HTTPException(status_code=404, detail="Khata account not found.")
        
    # Safety feature: Unlink historical transactions rather than deleting them
    # Set khata_id to null for all transactions associated with this account
    await db.transactions.update_many(
        {"khata_id": oid},
        {"$set": {"khata_id": None}}
    )
    
    # Delete the account
    await db.khata_accounts.delete_one({"_id": oid})
    
    return {"message": "Khata account deleted successfully. Historical transactions have been unlinked and preserved."}
