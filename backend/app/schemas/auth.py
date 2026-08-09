from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserRegister(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleLoginRequest(BaseModel):
    id_token: str

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    name: str
    created_at: datetime

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "id": "60d5ec4934ed4c28f09b23b1",
                "email": "user@example.com",
                "name": "Rohan Sharma",
                "created_at": "2026-08-09T17:28:40"
            }
        }

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
