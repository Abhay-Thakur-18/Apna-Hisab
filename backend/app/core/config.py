import os
from pydantic_settings import BaseSettings
from typing import Optional

# Search for the .env file in the current folder or one folder up
env_path = ".env"
if not os.path.exists(env_path):
    if os.path.exists("../.env"):
        env_path = "../.env"
    elif os.path.exists("../../.env"):
        env_path = "../../.env"

class Settings(BaseSettings):
    MONGODB_URI: str = "mongodb://localhost:27017/apna_hisab"
    MONGODB_DB_NAME: str = "apna_hisab"
    MONGO_URI: Optional[str] = None
    ENVIRONMENT: str = "development"

    @property
    def effective_mongo_uri(self) -> str:
        uri = self.MONGODB_URI
        if self.MONGO_URI and self.MONGODB_URI == "mongodb://localhost:27017/apna_hisab":
            uri = self.MONGO_URI
            
        if self.ENVIRONMENT.lower() == "production":
            if "localhost" in uri or "127.0.0.1" in uri:
                raise ValueError(
                    "Production environment detected, but MongoDB URI points to a localhost database. "
                    "Please set a valid production MONGODB_URI or MONGO_URI."
                )
        return uri
    JWT_SECRET: str = "8f5db9bb6e24db49f691823ac56bf47de7d69b4c049e290f612be98bc5eb7b3d"
    CORS_ORIGINS: str = "*"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200  # 30 days (default for persistent mobile sessions)
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    
    # Google Sign-In Client IDs
    GOOGLE_CLIENT_ID_WEB: Optional[str] = ""
    GOOGLE_CLIENT_ID_ANDROID: Optional[str] = ""
    GOOGLE_CLIENT_ID_IOS: Optional[str] = ""

    class Config:
        env_file = env_path
        env_file_encoding = 'utf-8'
        extra = "ignore"

settings = Settings()
