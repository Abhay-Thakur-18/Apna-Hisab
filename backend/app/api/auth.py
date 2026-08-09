from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import get_db
from app.schemas.auth import UserRegister, UserLogin, GoogleLoginRequest, UserResponse, Token
from app.auth.security import hash_password, verify_password, create_access_token
from app.auth.google import verify_google_id_token
from app.auth.dependencies import get_current_user
from app.utils.serialize import serialize_doc

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister):
    db = get_db()
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email.lower()})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists."
        )
        
    hashed_pwd = hash_password(user_data.password)
    
    user_doc = {
        "email": user_data.email.lower(),
        "name": user_data.name,
        "password_hash": hashed_pwd,
        "google_id": None,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    
    return serialize_doc(user_doc)

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    db = get_db()
    
    user = await db.users.find_one({"email": credentials.email.lower()})
    if not user or not user.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
        
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
        
    user_id = str(user["_id"])
    access_token = create_access_token(data={"sub": user_id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": serialize_doc(user)
    }

@router.post("/google", response_model=Token)
async def google_login(login_req: GoogleLoginRequest):
    # Verify the Google ID Token
    google_user = await verify_google_id_token(login_req.id_token)
    if not google_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google OAuth token."
        )
        
    db = get_db()
    email = google_user["email"].lower()
    
    # Check if user already exists by email
    user = await db.users.find_one({"email": email})
    
    if user:
        # Link Google ID if not already done
        if not user.get("google_id"):
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"google_id": google_user["google_id"]}}
            )
            user["google_id"] = google_user["google_id"]
    else:
        # Create a new user since email doesn't exist
        user_doc = {
            "email": email,
            "name": google_user["name"],
            "password_hash": None,
            "google_id": google_user["google_id"],
            "created_at": datetime.now(timezone.utc)
        }
        result = await db.users.insert_one(user_doc)
        user_doc["_id"] = result.inserted_id
        user = user_doc
        
    user_id = str(user["_id"])
    access_token = create_access_token(data={"sub": user_id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": serialize_doc(user)
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@router.post("/delete-account", status_code=status.HTTP_200_OK)
async def delete_account(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = ObjectId(current_user["id"])
    
    # Securely delete all records owned by the user to ensure data privacy
    await db.transactions.delete_many({"user_id": user_id})
    await db.khata_accounts.delete_many({"user_id": user_id})
    await db.payments.delete_many({"user_id": user_id})
    await db.categories.delete_many({"user_id": user_id})
    
    # Delete user account itself
    await db.users.delete_one({"_id": user_id})
    
    return {"message": "Account and all associated financial data have been permanently deleted."}
