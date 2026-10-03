import fitz  # pymupdf
from typing import List, Dict
import asyncio
import uuid

from src.config import settings
from src.services.embeddings import embedding_service
from src.services.vector_store import vector_store


class PDFProcessor:
    def __init__(self):
        self.chunk_size = settings.chunk_size
        self.chunk_overlap = settings.chunk_overlap

    def extract_text(self, pdf_path: str) -> str:
        """Extract text from PDF."""
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text

    def chunk_text(self, text: str) -> List[Dict]:
        """Split text into overlapping chunks."""
        words = text.split()
        chunks = []
        
        for i in range(0, len(words), self.chunk_size - self.chunk_overlap):
            chunk_words = words[i:i + self.chunk_size]
            chunk_text = " ".join(chunk_words)
            if len(chunk_text.strip()) > 50:  # Skip tiny chunks
                chunks.append({
                    "content": chunk_text,
                    "token_count": len(chunk_words),
                })
        
        return chunks

    async def process_pdf(self, paper_id: str, pdf_path: str) -> List[Dict]:
        """Full PDF processing pipeline: extract -> chunk -> embed -> store."""
        # Extract text
        text = await asyncio.to_thread(self.extract_text, pdf_path)
        
        # Chunk
        chunks = self.chunk_text(text)
        
        # Generate embeddings
        chunk_texts = [c["content"] for c in chunks]
        embeddings = await embedding_service.embed_texts(chunk_texts)
        
        # Prepare for storage
        processed_chunks = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            chroma_id = str(uuid.uuid4())
            processed_chunks.append({
                "paper_id": paper_id,
                "chunk_index": i,
                "content": chunk["content"],
                "token_count": chunk["token_count"],
                "embedding": embedding,
                "chroma_id": chroma_id,
            })
        
        # Store in Chroma
        vector_store.upsert_chunks(processed_chunks)
        
        return processed_chunks


pdf_processor = PDFProcessor()