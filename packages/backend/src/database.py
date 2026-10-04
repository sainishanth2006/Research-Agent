from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from contextlib import asynccontextmanager
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from src.config import settings


class Base(DeclarativeBase):
    pass


def _async_database_url(database_url: str) -> str:
    """Convert the Prisma URL format to an asyncpg-compatible URL."""
    parsed = urlsplit(database_url)
    query = [(key, value) for key, value in parse_qsl(parsed.query) if key != "schema"]
    normalized = urlunsplit(parsed._replace(query=urlencode(query)))
    return normalized.replace("postgresql://", "postgresql+asyncpg://", 1)


# Create async engine
engine = create_async_engine(
    _async_database_url(settings.database_url),
    echo=False,  # Set to True for SQL debugging
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def init_db() -> None:
    """Initialize database - create tables if they don't exist."""
    # Tables are managed by Prisma migrations
    # This function can be used for any additional setup
    pass


async def close_db() -> None:
    """Close database connections."""
    await engine.dispose()


@asynccontextmanager
async def get_db_session():
    """Get a database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# FastAPI dependency
async def get_db() -> AsyncSession:
    async with get_db_session() as session:
        yield session