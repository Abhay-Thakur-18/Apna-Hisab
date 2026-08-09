import pytest
import pytest_asyncio
import os
import asyncio

# Force MONGODB_URI to use a test database before any app modules load
os.environ["MONGODB_URI"] = "mongodb://localhost:27017/apna_hisab_test"
os.environ["MONGODB_DB_NAME"] = "apna_hisab_test"
os.environ["MONGO_URI"] = "mongodb://localhost:27017/apna_hisab_test"

from app.core.config import settings
from app.core.database import get_db, close_mongo_connection, connect_to_mongo

@pytest_asyncio.fixture(scope="function")
async def setup_db():
    """
    Ensures MongoDB connects and disconnects for transaction test functions.
    Clears leftover data from the test database.
    """
    # Override settings explicitly
    settings.MONGODB_URI = "mongodb://localhost:27017/apna_hisab_test"
    settings.MONGODB_DB_NAME = "apna_hisab_test"
    settings.MONGO_URI = "mongodb://localhost:27017/apna_hisab_test"
    await connect_to_mongo()
    
    db = get_db()
    
    # Clean database before tests run
    collections = await db.list_collection_names()
    for col in collections:
        if not col.startswith("system."):
            await db[col].delete_many({})
            
    yield db
    
    close_mongo_connection()

@pytest_asyncio.fixture(scope="function")
async def clear_collections(setup_db):
    """
    Clears transaction and payment collections.
    """
    db = setup_db
    collections = await db.list_collection_names()
    for col in collections:
        if not col.startswith("system."):
            await db[col].delete_many({})
