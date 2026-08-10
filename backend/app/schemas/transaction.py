from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

class TransactionBase(BaseModel):
    amount: int = Field(..., description="Amount in paise (e.g. 100 paise = 1 Rupee)")
    type: str = Field(..., description="income or expense")
    category: str
    subcategory: str
    payment_method: str = Field("None", description="UPI, Cash, Debit Card, Credit Card, or None")
    date: str = Field(..., description="YYYY-MM-DD format")
    time: str = Field(..., description="HH:MM:SS format")
    description: Optional[str] = ""
    khata_id: Optional[str] = Field(None, description="Optional associated Khata Account ID")
    khata_type: Optional[str] = Field(None, description="udhar_diya or udhar_liya")
    client_ref_id: Optional[str] = Field(None, description="Unique client-side reference ID for offline idempotency")

class TransactionCreate(TransactionBase):
    status: str = Field("paid", description="paid, pending, or partially_paid")
    paid_amount: Optional[int] = Field(None, description="Paid amount in paise. Defaults based on status.")

class TransactionUpdate(BaseModel):
    amount: Optional[int] = Field(None, description="Amount in paise")
    type: Optional[str] = Field(None, description="income or expense")
    category: Optional[str] = None
    subcategory: Optional[str] = None
    payment_method: Optional[str] = Field(None, description="UPI, Cash, Debit Card, Credit Card, or None")
    date: Optional[str] = Field(None, description="YYYY-MM-DD format")
    time: Optional[str] = Field(None, description="HH:MM:SS format")
    description: Optional[str] = None
    status: Optional[str] = Field(None, description="paid, pending, or partially_paid")
    paid_amount: Optional[int] = Field(None, description="Paid amount in paise")
    khata_id: Optional[str] = Field(None, description="Optional associated Khata Account ID")
    khata_type: Optional[str] = Field(None, description="udhar_diya or udhar_liya")

class TransactionResponse(TransactionBase):
    id: str
    paid_amount: int
    pending_amount: int
    status: str
    user_id: str
    recurring_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True

# --- KHATA SCHEMAS ---

class KhataAccountBase(BaseModel):
    name: str = Field(..., description="Name of the person, supplier or service (e.g., Tiffin, Milkman)")
    description: Optional[str] = ""
    client_ref_id: Optional[str] = Field(None, description="Unique client-side reference ID for offline idempotency")

class KhataAccountCreate(KhataAccountBase):
    pass

class KhataAccountResponse(KhataAccountBase):
    id: str
    user_id: str
    total_pending: int = 0
    total_paid: int = 0
    outstanding: int = 0
    total_udhar_diya_pending: int = 0
    total_udhar_liya_pending: int = 0
    created_at: datetime
    updated_at: datetime

# --- PAYMENT SCHEMAS ---

class PaymentCreate(BaseModel):
    transaction_id: str = Field(..., description="ID of the pending/partially paid transaction being paid off")
    amount: int = Field(..., description="Amount of this payment in paise")
    payment_method: str = Field("UPI", description="UPI, Cash, Debit Card, or Credit Card")
    date: str = Field(..., description="YYYY-MM-DD format")
    time: str = Field(..., description="HH:MM:SS format")
    description: Optional[str] = ""
    client_ref_id: Optional[str] = Field(None, description="Unique client-side reference ID for offline idempotency")

class PaymentResponse(BaseModel):
    id: str
    user_id: str
    khata_id: Optional[str] = None
    transaction_id: str
    amount: int
    payment_method: str
    date: str
    time: str
    description: str
    created_at: datetime
