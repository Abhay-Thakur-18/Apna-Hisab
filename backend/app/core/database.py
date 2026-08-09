from motor.motor_asyncio import AsyncIOMotorClient
from urllib.parse import urlparse
import logging
from app.core.config import settings

logger = logging.getLogger("apna_hisab.database")

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    logger.info("Connecting to MongoDB...")
    uri = settings.effective_mongo_uri
    db_name = settings.MONGODB_DB_NAME
    
    # Initialize AsyncIOMotorClient with standard Atlas options and connection timeout
    db_instance.client = AsyncIOMotorClient(
        uri,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000
    )
    
    # Perform standard ping handshake to verify database connection health
    try:
        await db_instance.client.admin.command("ping")
        logger.info("MongoDB handshake/ping successful.")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        db_instance.client = None
        db_instance.db = None
        raise e
        
    db_instance.db = db_instance.client[db_name]
    logger.info(f"Connected to database: {db_name}")

def close_mongo_connection():
    logger.info("Closing MongoDB connection...")
    if db_instance.client is not None:
        db_instance.client.close()
        db_instance.client = None
        db_instance.db = None
        logger.info("MongoDB connection closed.")

def get_db():
    if db_instance.db is None:
        raise RuntimeError("Database not initialized. Ensure connect_to_mongo was called at startup.")
    return db_instance.db
