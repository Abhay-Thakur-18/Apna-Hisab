from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.schemas.recurring import RecurringTransactionCreate, RecurringTransactionResponse
from app.services.recurring_service import check_due_recurring, approve_recurring_instance
from app.utils.serialize import serialize_doc, serialize_list

router = APIRouter(prefix="/api/recurring", tags=["Recurring Schedules"])

class RecurringUpdate(BaseModel):
    amount: Optional[int] = None
    frequency: Optional[str] = None
    status: Optional[str] = None # active or paused
    payment_method: Optional[str] = None
    description: Optional[str] = None

@router.get("", response_model=List[RecurringTransactionResponse])
async def list_recurring_templates(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.recurring_transactions.find({"user_id": ObjectId(current_user["id"])})
    docs = await cursor.to_list(length=100)
    return serialize_list(docs)

@router.post("", response_model=RecurringTransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_recurring_template(
    template: RecurringTransactionCreate,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    # Validation checks
    freq = template.frequency.lower()
    if freq not in ["daily", "weekly", "monthly"]:
        raise HTTPException(status_code=400, detail="Frequency must be daily, weekly, or monthly.")
        
    khata_oid = None
    if template.khata_id:
        try:
            khata_oid = ObjectId(template.khata_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid Khata ID format.")
            
        khata_acc = await db.khata_accounts.find_one({"_id": khata_oid, "user_id": ObjectId(current_user["id"])})
        if not khata_acc:
            raise HTTPException(status_code=404, detail="Khata account not found.")

    doc = {
        "user_id": ObjectId(current_user["id"]),
        "amount": template.amount,
        "type": template.type.lower(),
        "category": template.category,
        "subcategory": template.subcategory,
        "payment_method": template.payment_method,
        "frequency": freq,
        "start_date": template.start_date,
        "last_generated_date": None,
        "status": "active",
        "description": template.description,
        "khata_id": khata_oid,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.recurring_transactions.insert_one(doc)
    doc["_id"] = result.inserted_id
    
    return serialize_doc(doc)

@router.patch("/{id}", response_model=RecurringTransactionResponse)
async def update_recurring_template(
    id: str,
    update_data: RecurringUpdate,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format.")
        
    template = await db.recurring_transactions.find_one({"_id": oid, "user_id": ObjectId(current_user["id"])})
    if not template:
        raise HTTPException(status_code=404, detail="Recurring template not found.")
        
    updates = {}
    if update_data.amount is not None:
        updates["amount"] = update_data.amount
    if update_data.frequency is not None:
        freq = update_data.frequency.lower()
        if freq not in ["daily", "weekly", "monthly"]:
            raise HTTPException(status_code=400, detail="Frequency must be daily, weekly, or monthly.")
        updates["frequency"] = freq
    if update_data.status is not None:
        stat = update_data.status.lower()
        if stat not in ["active", "paused"]:
            raise HTTPException(status_code=400, detail="Status must be active or paused.")
        updates["status"] = stat
    if update_data.payment_method is not None:
        updates["payment_method"] = update_data.payment_method
    if update_data.description is not None:
        updates["description"] = update_data.description
        
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        await db.recurring_transactions.update_one({"_id": oid}, {"$set": updates})
        template = await db.recurring_transactions.find_one({"_id": oid})
        
    return serialize_doc(template)

@router.delete("/{id}")
async def delete_recurring_template(id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format.")
        
    template = await db.recurring_transactions.find_one({"_id": oid, "user_id": ObjectId(current_user["id"])})
    if not template:
        raise HTTPException(status_code=404, detail="Recurring template not found.")
        
    await db.recurring_transactions.delete_one({"_id": oid})
    
    # We unlink transactions that were generated by this template (set recurring_id to null)
    # to preserve historical record integrity.
    await db.transactions.update_many(
        {"recurring_id": oid},
        {"$set": {"recurring_id": None}}
    )
    
    return {"message": "Recurring template stopped and deleted successfully."}

@router.get("/due")
async def get_due_instances(
    client_today: str = Query(..., description="Client current local date YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user)
):
    return await check_due_recurring(current_user["id"], client_today)

@router.post("/approve")
async def approve_instance(
    instance: dict,
    current_user: dict = Depends(get_current_user)
):
    try:
        tx_doc = await approve_recurring_instance(current_user["id"], instance)
        return tx_doc
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
