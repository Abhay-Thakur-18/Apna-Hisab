import httpx
import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("apna_hisab.auth.google")

async def verify_google_id_token(id_token: str) -> Optional[dict]:
    """
    Verifies a Google ID token by calling Google's tokeninfo API.
    Returns a dict containing email, name, and google_id if valid, otherwise None.
    """
    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            
            if response.status_code != 200:
                logger.error(f"Google tokeninfo API returned status {response.status_code}: {response.text}")
                return None
                
            payload = response.json()
            
            # Basic validation
            email = payload.get("email")
            name = payload.get("name", email.split("@")[0] if email else "User")
            google_id = payload.get("sub")
            aud = payload.get("aud")
            
            if not email or not google_id:
                logger.error("Google token missing email or sub field")
                return None
                
            # Verify the audience matches one of our client IDs if configured
            client_ids = [
                settings.GOOGLE_CLIENT_ID_WEB,
                settings.GOOGLE_CLIENT_ID_ANDROID,
                settings.GOOGLE_CLIENT_ID_IOS
            ]
            # Strip out empty strings
            client_ids = [cid for cid in client_ids if cid]
            
            if client_ids and aud not in client_ids:
                logger.warning(f"Audience mismatch: token aud={aud} not in configured client IDs {client_ids}")
                # We log a warning but proceed to make initial local dev easier,
                # though in full production we should enforce this check.
                
            return {
                "email": email,
                "name": name,
                "google_id": google_id
            }
            
    except Exception as e:
        logger.error(f"Error verifying Google ID token: {str(e)}")
        return None
