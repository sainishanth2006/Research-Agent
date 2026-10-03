import chromadb
from typing import List, Optional, Dict, Any
import uuid

from src.config import settings


class VectorStore:
    def __init__(self):
        self.client = chromadb.HttpClient(
            host=settings.chroma_host,
            port=settings.chroma_port
        )
        self.collection = self.client.get_or_create_collection(
            name=settings.chroma_collection,
            metadata={"hnsw:space": "cosine"}
        )

    def upsert_chunks(self, chunks: List[dict]) -> List[str]:
        """Upsert paper chunks with embeddings."""
        if not chunks:
            return []
        
        ids = [chunk["chroma_id"] or str(uuid.uuid4()) for chunk in chunks]
        documents = [chunk["content"] for chunk in chunks]
        embeddings = [chunk["embedding"] for chunk in chunks]
        metadatas = [{
            "paper_id": chunk["paper_id"],
            "chunk_index": chunk["chunk_index"],
            "token_count": chunk["token_count"],
        } for chunk in chunks]
        
        self.collection.upsert(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas
        )
        return ids

    def query(self, query_embedding: List[float], n_results: int = 20, 
              where: Optional[Dict] = None) -> Dict[str, Any]:
        """Query similar chunks."""
        return self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where,
            include=["documents", "metadatas", "distances"]
        )

    def delete_paper_chunks(self, paper_id: str):
        """Delete all chunks for a paper."""
        self.collection.delete(where={"paper_id": paper_id})

    def get_chunks(self, paper_id: str) -> List[dict]:
        """Get all chunks for a paper."""
        results = self.collection.get(
            where={"paper_id": paper_id},
            include=["documents", "metadatas"]
        )
        chunks = []
        for i, doc in enumerate(results["documents"]):
            chunks.append({
                "content": doc,
                "chunk_index": results["metadatas"][i]["chunk_index"],
                "chroma_id": results["ids"][i],
            })
        return chunks


vector_store = VectorStore()