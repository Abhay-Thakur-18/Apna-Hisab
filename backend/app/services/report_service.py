from bson import ObjectId
from datetime import datetime, timedelta, timezone
from app.core.database import get_db

async def generate_financial_report(user_id: str, start_date: str, end_date: str) -> dict:
    """
    Generates summary metrics and breakdowns (category, payment method, daily, and top transactions)
    for a given date range (inclusive) for the specified user.
    """
    db = get_db()
    user_oid = ObjectId(user_id)
    
    # Match query for date range and user
    match_query = {
        "user_id": user_oid,
        "date": {"$gte": start_date, "$lte": end_date}
    }
    
    # 1. Summary Metrics: Total Income, Expenses (Paid Amount), and Pending
    # Note: Income is treated as completed (we count full amount), Expenses are counted by paid_amount.
    summary_pipeline = [
        {"$match": match_query},
        {"$group": {
            "_id": None,
            "total_income": {
                "$sum": {
                    "$cond": [{"$eq": ["$type", "income"]}, "$amount", 0]
                }
            },
            "total_expense": {
                "$sum": {
                    "$cond": [{"$eq": ["$type", "expense"]}, "$paid_amount", 0]
                }
            },
            "total_pending": {
                "$sum": {
                    "$cond": [{"$eq": ["$type", "expense"]}, "$pending_amount", 0]
                }
            }
        }}
    ]
    
    summary_cursor = db.transactions.aggregate(summary_pipeline)
    summary_res = await summary_cursor.to_list(length=1)
    
    summary = summary_res[0] if summary_res else {
        "total_income": 0,
        "total_expense": 0,
        "total_pending": 0
    }
    summary.pop("_id", None)
    summary["remaining_balance"] = summary["total_income"] - summary["total_expense"]
    
    # 2. Category-wise Expense Breakdown
    category_pipeline = [
        {"$match": {**match_query, "type": "expense"}},
        {"$group": {
            "_id": "$category",
            "amount": {"$sum": "$paid_amount"}
        }},
        {"$sort": {"amount": -1}}
    ]
    category_cursor = db.transactions.aggregate(category_pipeline)
    category_res = await category_cursor.to_list(length=50)
    category_breakdown = [{"category": doc["_id"], "amount": doc["amount"]} for doc in category_res]
    
    # 3. Payment Method Expense Breakdown
    payment_pipeline = [
        {"$match": {**match_query, "type": "expense", "status": {"$ne": "pending"}}},
        {"$group": {
            "_id": "$payment_method",
            "amount": {"$sum": "$paid_amount"}
        }},
        {"$sort": {"amount": -1}}
    ]
    payment_cursor = db.transactions.aggregate(payment_pipeline)
    payment_res = await payment_cursor.to_list(length=20)
    payment_breakdown = [{"method": doc["_id"], "amount": doc["amount"]} for doc in payment_res]
    
    # 4. Daily Expense Breakdown
    daily_pipeline = [
        {"$match": {**match_query, "type": "expense"}},
        {"$group": {
            "_id": "$date",
            "amount": {"$sum": "$paid_amount"}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_cursor = db.transactions.aggregate(daily_pipeline)
    daily_res = await daily_cursor.to_list(length=366)
    daily_breakdown = [{"date": doc["_id"], "amount": doc["amount"]} for doc in daily_res]
    
    # 5. Top spending categories (max 5)
    top_categories = category_breakdown[:5]
    
    # 6. Largest individual expenses (max 5)
    largest_expenses_cursor = db.transactions.find(
        {**match_query, "type": "expense"}
    ).sort("amount", -1).limit(5)
    largest_docs = await largest_expenses_cursor.to_list(length=5)
    
    largest_expenses = []
    for doc in largest_docs:
        largest_expenses.append({
            "id": str(doc["_id"]),
            "amount": doc["amount"],
            "paid_amount": doc["paid_amount"],
            "category": doc["category"],
            "subcategory": doc["subcategory"],
            "date": doc["date"],
            "description": doc.get("description", "")
        })
        
    return {
        "summary": summary,
        "category_breakdown": category_breakdown,
        "payment_breakdown": payment_breakdown,
        "daily_breakdown": daily_breakdown,
        "top_categories": top_categories,
        "largest_expenses": largest_expenses,
        "start_date": start_date,
        "end_date": end_date
    }
