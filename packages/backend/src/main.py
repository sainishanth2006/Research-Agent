from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from src.config import settings
from src.database import init_db, close_db
from src.api.v1 import search, papers, chat, collections, auth, research

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up MRDU Backend...")
    await init_db()
    logger.info("Database initialized")

    yield

    # Shutdown
    logger.info("Shutting down MRDU Backend...")
    await close_db()
    logger.info("Database connections closed")


app = FastAPI(
    title="MRDU - AI Research Literature Discovery Agent",
    description="Backend API for the AI Research Literature Discovery Agent",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "mrdu-backend"}


# API routes
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(papers.router, prefix="/api/v1/papers", tags=["papers"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(collections.router, prefix="/api/v1/collections", tags=["collections"])
app.include_router(research.router, prefix="/api/v1/research", tags=["research"])


# Root endpoint
@app.get("/")
async def root():
    return {
        "name": "MRDU API",
        "version": "0.1.0",
        "description": "AI Research Literature Discovery Agent",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )