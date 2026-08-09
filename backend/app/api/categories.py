from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from typing import List, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.utils.serialize import serialize_doc, serialize_list

router = APIRouter(prefix="/api/categories", tags=["Custom Categories"])

class CategoryCreate(BaseModel):
    name: str
    type: str # income or expense
    subcategories: List[str] = []

@router.get("")
async def list_categories(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.categories.find({"user_id": ObjectId(current_user["id"])})
    custom_categories = await cursor.to_list(length=100)
    return serialize_list(custom_categories)

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_category(category: CategoryCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    # Check if category with same name and type already exists
    existing = await db.categories.find_one({
        "user_id": ObjectId(current_user["id"]),
        "name": {"$regex": f"^{category.name}$", "$options": "i"},
        "type": category.type
    })
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Category already exists."
        )
        
    doc = {
        "user_id": ObjectId(current_user["id"]),
        "name": category.name,
        "type": category.type.lower(),
        "subcategories": category.subcategories,
        "is_default": False
    }
    
    result = await db.categories.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)

@router.delete("/{id}")
async def delete_category(id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Category ID format.")
        
    category = await db.categories.find_one({"_id": oid, "user_id": ObjectId(current_user["id"])})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")
        
    # Delete the category
    await db.categories.delete_one({"_id": oid})
    return {"message": "Custom category deleted successfully."}
