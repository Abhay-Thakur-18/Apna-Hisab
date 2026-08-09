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
    MONGO_URI: str = "mongodb://localhost:27017/apna_hisab"
    JWT_SECRET: str = "8f5db9bb6e24db49f691823ac56bf47de7d69b4c049e290f612be98bc5eb7b3d"
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
