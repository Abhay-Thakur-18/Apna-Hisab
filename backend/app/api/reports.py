from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timedelta
from typing import Optional
from app.auth.dependencies import get_current_user
from app.services.report_service import generate_financial_report

router = APIRouter(prefix="/api/reports", tags=["Financial Reports"])

@router.get("")
async def get_reports(
    period: str = Query(..., regex="^(weekly|monthly|6months|yearly|custom)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    client_today: Optional[str] = Query(None, description="Client local date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    # 1. Resolve date range
    if period == "custom":
        if not start_date or not end_date:
            raise HTTPException(
                status_code=400,
                detail="start_date and end_date must be provided for custom period."
            )
        resolved_start = start_date
        resolved_end = end_date
    else:
        # Resolve today's date
        if client_today:
            try:
                today = datetime.strptime(client_today, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=400, 
                    detail="Invalid client_today date format. Must be YYYY-MM-DD."
                )
        else:
            today = datetime.now().date()
            
        if period == "weekly":
            resolved_start = (today - timedelta(days=6)).strftime("%Y-%m-%d")
            resolved_end = today.strftime("%Y-%m-%d")
        elif period == "monthly":
            resolved_start = (today - timedelta(days=29)).strftime("%Y-%m-%d")
            resolved_end = today.strftime("%Y-%m-%d")
        elif period == "6months":
            resolved_start = (today - timedelta(days=179)).strftime("%Y-%m-%d")
            resolved_end = today.strftime("%Y-%m-%d")
        elif period == "yearly":
            resolved_start = (today - timedelta(days=364)).strftime("%Y-%m-%d")
            resolved_end = today.strftime("%Y-%m-%d")
            
    # 2. Invoke service to compile aggregate data
    report_data = await generate_financial_report(
        user_id=current_user["id"],
        start_date=resolved_start,
        end_date=resolved_end
    )
    
    return report_data
