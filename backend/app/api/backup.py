from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from bson import ObjectId
import io
import csv
from datetime import datetime, timezone
from typing import List
from pydantic import BaseModel
from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.services.money_service import paise_to_rupees
from app.utils.serialize import serialize_list

router = APIRouter(prefix="/api/backup", tags=["Data Backup & Export"])

class BackupData(BaseModel):
    transactions: List[dict] = []
    khata_accounts: List[dict] = []
    payments: List[dict] = []
    categories: List[dict] = []

@router.get("/export/json")
async def export_json_backup(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_oid = ObjectId(current_user["id"])
    
    # Query all user-owned records
    transactions = await db.transactions.find({"user_id": user_oid}).to_list(length=5000)
    khata_accounts = await db.khata_accounts.find({"user_id": user_oid}).to_list(length=500)
    payments = await db.payments.find({"user_id": user_oid}).to_list(length=5000)
    categories = await db.categories.find({"user_id": user_oid}).to_list(length=200)
    
    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "user_email": current_user["email"],
        "transactions": serialize_list(transactions),
        "khata_accounts": serialize_list(khata_accounts),
        "payments": serialize_list(payments),
        "categories": serialize_list(categories)
    }

@router.get("/export/csv")
async def export_csv_statement(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_oid = ObjectId(current_user["id"])
    
    # Query all transactions
    cursor = db.transactions.find({"user_id": user_oid}).sort([("date", -1), ("time", -1)])
    transactions = await cursor.to_list(length=5000)
    
    # Create an in-memory string buffer for CSV generation
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header row
    writer.writerow([
        "Date", "Time", "Type", "Category", "Subcategory", 
        "Amount (INR)", "Paid Amount (INR)", "Pending Amount (INR)", 
        "Status", "Payment Method", "Description"
    ])
    
    # Write transaction rows
    for tx in transactions:
        writer.writerow([
            tx["date"],
            tx["time"],
            tx["type"].upper(),
            tx["category"],
            tx["subcategory"],
            f"{paise_to_rupees(tx['amount']):.2f}",
            f"{paise_to_rupees(tx.get('paid_amount', tx['amount'])):.2f}",
            f"{paise_to_rupees(tx.get('pending_amount', 0)):.2f}",
            tx.get("status", "paid").upper(),
            tx["payment_method"],
            tx.get("description", "")
        ])
        
    output.seek(0)
    
    # Stream the file back to client
    filename = f"apna_hisab_statement_{datetime.now().strftime('%Y%m%d')}.csv"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    
    return StreamingResponse(
        iter([output.getvalue()]), 
        media_type="text/csv", 
        headers=headers
    )

@router.post("/import/json")
async def import_json_restore(backup: BackupData, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_oid = ObjectId(current_user["id"])
    
    # To keep references consistent, we must map imported IDs to new MongoDB IDs
    id_map = {} # old_id_str -> new_ObjectId
    
    # Start transaction-like sequential load (since MongoDB standalone doesn't support multi-doc transactions
    # without replica sets, we process them sequentially and securely).
    
    try:
      # A. Restore Categories
      if backup.categories:
          # Delete current custom categories
          await db.categories.delete_many({"user_id": user_oid})
          
          for cat in backup.categories:
              old_id = cat.get("id") or cat.get("_id")
              cat_doc = {
                  "user_id": user_oid,
                  "name": cat["name"],
                  "type": cat["type"],
                  "subcategories": cat.get("subcategories", []),
                  "is_default": cat.get("is_default", False)
              }
              res = await db.categories.insert_one(cat_doc)
              if old_id:
                  id_map[str(old_id)] = res.inserted_id
                  
      # B. Restore Khata Accounts
      if backup.khata_accounts:
          # Delete current accounts
          await db.khata_accounts.delete_many({"user_id": user_oid})
          
          for acc in backup.khata_accounts:
              old_id = acc.get("id") or acc.get("_id")
              acc_doc = {
                  "user_id": user_oid,
                  "name": acc["name"],
                  "description": acc.get("description", ""),
                  "created_at": datetime.fromisoformat(acc["created_at"].replace("Z", "+00:00")) if "created_at" in acc else datetime.now(timezone.utc),
                  "updated_at": datetime.now(timezone.utc)
              }
              res = await db.khata_accounts.insert_one(acc_doc)
              if old_id:
                  id_map[str(old_id)] = res.inserted_id

      # C. Restore Transactions
      # We delete current transactions and payments
      await db.transactions.delete_many({"user_id": user_oid})
      await db.payments.delete_many({"user_id": user_oid})
      
      for tx in backup.transactions:
          old_id = tx.get("id") or tx.get("_id")
          
          # Map Khata ID if present
          khata_oid = None
          old_khata_id = tx.get("khata_id")
          if old_khata_id and str(old_khata_id) in id_map:
              khata_oid = id_map[str(old_khata_id)]
              
          tx_doc = {
              "user_id": user_oid,
              "amount": tx["amount"],
              "paid_amount": tx.get("paid_amount", tx["amount"]),
              "pending_amount": tx.get("pending_amount", 0),
              "type": tx["type"],
              "status": tx.get("status", "paid"),
              "category": tx["category"],
              "subcategory": tx["subcategory"],
              "payment_method": tx["payment_method"],
              "date": tx["date"],
              "time": tx["time"],
              "description": tx.get("description", ""),
              "khata_id": khata_oid,
              "recurring_id": None,
              "created_at": datetime.fromisoformat(tx["created_at"].replace("Z", "+00:00")) if "created_at" in tx else datetime.now(timezone.utc),
              "updated_at": datetime.now(timezone.utc)
          }
          res = await db.transactions.insert_one(tx_doc)
          if old_id:
              id_map[str(old_id)] = res.inserted_id

      # D. Restore Payments
      for pay in backup.payments:
          # Map transaction and khata ID
          tx_oid = None
          old_tx_id = pay.get("transaction_id")
          if old_tx_id and str(old_tx_id) in id_map:
              tx_oid = id_map[str(old_tx_id)]
              
          khata_oid = None
          old_khata_id = pay.get("khata_id")
          if old_khata_id and str(old_khata_id) in id_map:
              khata_oid = id_map[str(old_khata_id)]
              
          if not tx_oid:
              continue # skip orphan payments
              
          pay_doc = {
              "user_id": user_oid,
              "khata_id": khata_oid,
              "transaction_id": tx_oid,
              "amount": pay["amount"],
              "payment_method": pay["payment_method"],
              "date": pay["date"],
              "time": pay["time"],
              "description": pay.get("description", ""),
              "created_at": datetime.fromisoformat(pay["created_at"].replace("Z", "+00:00")) if "created_at" in pay else datetime.now(timezone.utc)
          }
          await db.payments.insert_one(pay_doc)
          
      return {"message": "Data restored successfully from backup."}
      
    except Exception as e:
      raise HTTPException(
          status_code=500,
          detail=f"An error occurred while importing backup: {str(e)}"
      )
