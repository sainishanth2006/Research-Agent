from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql://mrdu:mrdu@localhost:5432/mrdu?schema=public"

    # Vector Database (Chroma)
    chroma_host: str = "localhost"
    chroma_port: int = 8000
    chroma_collection: str = "papers"

    # LLM (Google Gemini)
    gemini_api_key: str = ""

    # Semantic Scholar API
    semantic_scholar_api_key: str = ""

    # Auth
    nextauth_secret: str = ""
    jwt_public_key: str = ""

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8001

    # Frontend URL (for CORS)
    frontend_url: str = "http://localhost:3000"

    # Embedding
    embedding_model: str = "text-embedding-004"
    embedding_dim: int = 768
    chunk_size: int = 500
    chunk_overlap: int = 50

    # Search
    default_search_limit: int = 20
    default_rerank_limit: int = 10

    # Gemini models
    gemini_models: dict = {"FLASH": "gemini-1.5-flash", "PRO": "gemini-1.5-pro", "EMBEDDING": "text-embedding-004"}

    @property
    def chroma_url(self) -> str:
        return f"http://{self.chroma_host}:{self.chroma_port}"


settings = Settings()