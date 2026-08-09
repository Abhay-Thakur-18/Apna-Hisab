from bson import ObjectId
from datetime import datetime, date, timedelta, timezone
import calendar
from app.core.database import get_db
from app.schemas.recurring import RecurringTransactionCreate
from app.services.transaction_service import create_transaction
from app.schemas.transaction import TransactionCreate
from app.utils.serialize import serialize_doc

def add_months(sourcedate: date, months: int) -> date:
    """
    Safely adds calendar months to a python date object,
    handling varying month lengths and leap years.
    """
    month = sourcedate.month - 1 + months
    year = sourcedate.year + month // 12
    month = month % 12 + 1
    day = min(sourcedate.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)

async def check_due_recurring(user_id: str, client_today: str) -> list:
    """
    Scans the user's active recurring templates and calculates which instances
    are due up to the client's current local date.
    """
    db = get_db()
    try:
        today = datetime.strptime(client_today, "%Y-%m-%d").date()
    except ValueError:
        today = datetime.now().date()
        
    user_oid = ObjectId(user_id)
    
    cursor = db.recurring_transactions.find({
        "user_id": user_oid,
        "status": "active"
    })
    schedules = await cursor.to_list(length=100)
    
    due_items = []
    for sched in schedules:
        # Determine starting date for next iteration calculation
        start_date_str = sched.get("last_generated_date") or sched["start_date"]
        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        except ValueError:
            continue
            
        current = start_date
        # Loop forward to catch up on any missing periods (e.g. daily entry over 3 offline days)
        while True:
            if sched["frequency"] == "daily":
                next_date = current + timedelta(days=1)
            elif sched["frequency"] == "weekly":
                next_date = current + timedelta(days=7)
            elif sched["frequency"] == "monthly":
                next_date = add_months(current, 1)
            else:
                break
                
            if next_date <= today:
                due_items.append({
                    "recurring_id": str(sched["_id"]),
                    "amount": sched["amount"],
                    "type": sched["type"],
                    "category": sched["category"],
                    "subcategory": sched["subcategory"],
                    "payment_method": sched["payment_method"],
                    "date": next_date.strftime("%Y-%m-%d"),
                    "time": "09:00:00", # Standard morning auto-entry time
                    "description": sched.get("description") or f"Recurring {sched['frequency']}",
                    "khata_id": str(sched["khata_id"]) if sched.get("khata_id") else None,
                    "status": "pending" if sched.get("khata_id") else "paid"
                })
                current = next_date
            else:
                break
                
    return due_items

async def approve_recurring_instance(user_id: str, instance: dict) -> dict:
    """
    Approves a due recurring instance, creates the actual transaction ledger document,
    and updates the parent template's last_generated_date tracking anchor.
    """
    db = get_db()
    
    recurring_id = instance.get("recurring_id")
    if not recurring_id:
        raise ValueError("recurring_id is required to generate instance.")
        
    # 1. Update the parent recurring schedule's last_generated_date
    sched_oid = ObjectId(recurring_id)
    
    # We update the schedule first to anchor it and prevent double-execution race conditions
    await db.recurring_transactions.update_one(
        {"_id": sched_oid, "user_id": ObjectId(user_id)},
        {
            "$set": {
                "last_generated_date": instance["date"],
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # 2. Create the actual transaction document
    tx_in = TransactionCreate(
        amount=instance["amount"],
        type=instance["type"],
        category=instance["category"],
        subcategory=instance["subcategory"],
        payment_method=instance["payment_method"],
        date=instance["date"],
        time=instance["time"],
        description=instance["description"],
        khata_id=instance.get("khata_id"),
        status=instance.get("status", "paid")
    )
    
    tx_doc = await create_transaction(user_id, tx_in)
    
    # Link the newly created transaction with its parent recurring template ID
    await db.transactions.update_one(
        {"_id": ObjectId(tx_doc["id"])},
        {"$set": {"recurring_id": sched_oid}}
    )
    tx_doc["recurring_id"] = recurring_id
    
    return tx_doc
