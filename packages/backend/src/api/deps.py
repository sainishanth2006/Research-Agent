from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Annotated

from src.database import get_db
from src.utils.security import verify_token, extract_token_from_header, TokenPayload


async def get_current_user(
    authorization: Annotated[Optional[str], Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> TokenPayload:
    """
    FastAPI dependency to get the current authenticated user.
    Validates the JWT token from the Authorization header.
    """
    token = extract_token_from_header(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if is_token_expired(payload):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Optionally verify user exists in database
    # For now, we trust the token payload

    return payload


def is_token_expired(payload: TokenPayload) -> bool:
    """Check if token is expired."""
    from datetime import datetime, timezone
    exp_datetime = datetime.fromtimestamp(payload.exp, tz=timezone.utc)
    return datetime.now(timezone.utc) > exp_datetime


# Type aliases for common dependencies
CurrentUser = Annotated[TokenPayload, Depends(get_current_user)]
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]