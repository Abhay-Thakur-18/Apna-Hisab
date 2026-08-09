from motor.motor_asyncio import AsyncIOMotorClient
from urllib.parse import urlparse
import logging
from app.core.config import settings

logger = logging.getLogger("apna_hisab.database")

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

def connect_to_mongo():
    logger.info("Connecting to MongoDB...")
    db_instance.client = AsyncIOMotorClient(settings.MONGO_URI)
    
    # Extract database name from connection URI path
    parsed_uri = urlparse(settings.MONGO_URI)
    db_name = parsed_uri.path.strip("/")
    if not db_name:
        db_name = "apna_hisab"
        
    db_instance.db = db_instance.client[db_name]
    logger.info(f"Connected to database: {db_name}")

def close_mongo_connection():
    logger.info("Closing MongoDB connection...")
    if db_instance.client is not None:
        db_instance.client.close()
        logger.info("MongoDB connection closed.")

def get_db():
    if db_instance.db is None:
        connect_to_mongo()
    return db_instance.db
