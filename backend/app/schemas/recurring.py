from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class RecurringTransactionCreate(BaseModel):
    amount: int = Field(..., description="Amount in paise")
    type: str = Field(..., description="income or expense")
    category: str
    subcategory: str
    payment_method: str = Field("None", description="UPI, Cash, Debit Card, Credit Card, or None")
    frequency: str = Field(..., description="daily, weekly, or monthly")
    start_date: str = Field(..., description="YYYY-MM-DD format")
    description: Optional[str] = ""
    khata_id: Optional[str] = None

class RecurringTransactionResponse(BaseModel):
    id: str
    user_id: str
    amount: int
    type: str
    category: str
    subcategory: str
    payment_method: str
    frequency: str
    start_date: str
    last_generated_date: Optional[str] = None
    status: str = "active" # active or paused
    description: str
    khata_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
