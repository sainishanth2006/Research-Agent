from jose import jwt, JWTError
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import logging
import uuid

from src.config import settings

logger = logging.getLogger(__name__)


class TokenPayload(BaseModel):
    sub: str  # user id
    email: str
    name: Optional[str] = None
    iat: int
    exp: int
    jti: str


def get_jwt_secret() -> str:
    """Get the JWT secret for HS256 signing."""
    return settings.nextauth_secret


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token (HS256 for development)."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=30)
    
    to_encode.update({
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": str(uuid.uuid4()),
    })
    
    # Use HS256 with secret for development
    secret = get_jwt_secret()
    encoded_jwt = jwt.encode(to_encode, secret, algorithm="HS256")
    return encoded_jwt


def get_jwt_public_key() -> str:
    """Get the JWT public key for RS256 verification."""
    # The public key should be in PEM format
    return settings.jwt_public_key


def verify_token(token: str) -> Optional[TokenPayload]:
    """
    Verify a NextAuth.js JWT token.
    Tries RS256 first, then falls back to HS256 for development.
    """
    # Try RS256 first (NextAuth default)
    public_key = get_jwt_public_key()
    if public_key and public_key != "YOUR_PUBLIC_KEY_HERE":
        try:
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience=None,
                issuer=None,
            )
            return TokenPayload(**payload)
        except JWTError as e:
            logger.debug(f"RS256 verification failed: {e}")
    
    # Fallback to HS256 for development
    try:
        secret = get_jwt_secret()
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience=None,
            issuer=None,
        )
        return TokenPayload(**payload)
    except JWTError as e:
        logger.warning(f"HS256 verification failed: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error during token verification: {e}")
        return None


def extract_token_from_header(authorization: Optional[str]) -> Optional[str]:
    """Extract Bearer token from Authorization header."""
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


def is_token_expired(payload: TokenPayload) -> bool:
    """Check if token is expired."""
    exp_datetime = datetime.fromtimestamp(payload.exp, tz=timezone.utc)
    return datetime.now(timezone.utc) > exp_datetime