import google.generativeai as genai
from typing import List
import asyncio

from src.config import settings

genai.configure(api_key=settings.gemini_api_key)


class EmbeddingService:
    def __init__(self):
        self.model = settings.embedding_model
        self.dim = settings.embedding_dim

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts."""
        if not texts:
            return []
        
        # Process in batches to avoid rate limits
        batch_size = 100
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            try:
                result = await asyncio.to_thread(
                    genai.embed_content,
                    model=self.model,
                    content=batch,
                    task_type="retrieval_document"
                )
                all_embeddings.extend(result["embedding"])
            except Exception as e:
                print(f"Embedding error: {e}")
                # Return zero vectors as fallback
                all_embeddings.extend([[0.0] * self.dim] * len(batch))
        
        return all_embeddings

    async def embed_query(self, query: str) -> List[float]:
        """Generate embedding for a search query."""
        try:
            result = await asyncio.to_thread(
                genai.embed_content,
                model=self.model,
                content=query,
                task_type="retrieval_query"
            )
            return result["embedding"]
        except Exception as e:
            print(f"Query embedding error: {e}")
            return [0.0] * self.dim


embedding_service = EmbeddingService()