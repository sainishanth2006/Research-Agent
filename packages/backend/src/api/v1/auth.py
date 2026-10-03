from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from sqlalchemy import text

from src.api.deps import get_current_user, CurrentUser, DatabaseSession
from src.utils.security import TokenPayload

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class VerifyResponse(BaseModel):
    valid: bool
    user_id: str
    email: str
    name: str | None = None


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class RegisterResponse(BaseModel):
    id: str
    email: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    user: RegisterResponse
    access_token: str


@router.get("/verify", response_model=VerifyResponse)
async def verify_token(current_user: CurrentUser):
    """
    Verify the current user's JWT token.
    Returns user info if valid.
    """
    return VerifyResponse(
        valid=True,
        user_id=current_user.sub,
        email=current_user.email,
        name=current_user.name,
    )


@router.get("/me")
async def get_current_user_info(current_user: CurrentUser):
    """Get current user information."""
    return {
        "id": current_user.sub,
        "email": current_user.email,
        "name": current_user.name,
    }


@router.get("/dashboard")
async def get_dashboard_stats(current_user: CurrentUser, db: DatabaseSession):
    result = await db.execute(
        text(
            """
            SELECT
              (SELECT COUNT(*) FROM "Collection" WHERE "userId" = :user_id) AS collections,
              (SELECT COUNT(*) FROM "SearchHistory" WHERE "userId" = :user_id) AS searches,
              (SELECT COUNT(*) FROM "ProjectPaper" pp
                 JOIN "ResearchProject" rp ON rp.id = pp."projectId"
                 WHERE rp."userId" = :user_id) AS saved_papers,
              (SELECT COUNT(*) FROM "ResearchProject" WHERE "userId" = :user_id) AS projects
            """
        ),
        {"user_id": current_user.sub},
    )
    row = result.mappings().one()
    return {
        "saved_papers": row["saved_papers"],
        "research_projects": row["projects"],
        "collections": row["collections"],
        "searches": row["searches"],
    }


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    request: RegisterRequest,
):
    """Register a new user using Prisma Client."""
    try:
        from prisma import Prisma
        
        db = Prisma()
        await db.connect()
        
        # Check if user already exists
        existing_user = await db.user.find_unique(where={"email": request.email})
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already exists",
            )
        
        # Hash password
        hashed_password = pwd_context.hash(request.password)
        
        # Create user
        new_user = await db.user.create(
            data={
                "email": request.email,
                "name": request.name,
                "passwordHash": hashed_password,
                "emailVerified": None,
            }
        )
        
        await db.disconnect()
        
        return RegisterResponse(
            id=new_user.id,
            email=new_user.email,
            name=new_user.name,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}",
        )


@router.post("/login", response_model=LoginResponse)
async def login_user(
    request: LoginRequest,
):
    """Authenticate user and return access token."""
    try:
        from prisma import Prisma
        from src.utils.security import create_access_token
        
        db = Prisma()
        await db.connect()
        
        # Find user
        user = await db.user.find_unique(where={"email": request.email})
        
        if not user or not user.passwordHash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        
        # Verify password
        if not pwd_context.verify(request.password, user.passwordHash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        
        # Create access token
        access_token = create_access_token(
            data={
                "sub": user.id,
                "email": user.email,
                "name": user.name,
            }
        )
        
        await db.disconnect()
        
        return LoginResponse(
            user=RegisterResponse(
                id=user.id,
                email=user.email,
                name=user.name,
            ),
            access_token=access_token,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}",
        )


from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str