from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import os
from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.api.auth import router as auth_router
from app.api.transactions import router as transactions_router
from app.api.khata import router as khata_router
from app.api.reports import router as reports_router
from app.api.categories import router as categories_router
from app.api.recurring import router as recurring_router
from app.api.backup import router as backup_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    yield
    # Shutdown
    close_mongo_connection()

app = FastAPI(
    title="Apna Hisab API",
    description="Backend API for Apna Hisab - Personal Finance Management App",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS origins safely for production and local development
cors_origins_str = settings.CORS_ORIGINS
if cors_origins_str == "*":
    origins = ["*"]
else:
    origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True if "*" not in origins else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth_router)
app.include_router(transactions_router)
app.include_router(khata_router)
app.include_router(reports_router)
app.include_router(categories_router)
app.include_router(recurring_router)
app.include_router(backup_router)

@app.get("/health")
async def health_check():
    from app.core.database import db_instance
    database_status = "unhealthy"
    try:
        if db_instance.client is not None:
            await db_instance.client.admin.command("ping")
            database_status = "healthy"
    except Exception as e:
        import logging
        logging.getLogger("apna_hisab.health").error(f"Health check MongoDB ping failed: {e}")
        
    return {
        "status": "healthy" if database_status == "healthy" else "unhealthy",
        "app": "Apna Hisab API",
        "version": "1.0.0",
        "database": {
            "status": database_status
        }
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
