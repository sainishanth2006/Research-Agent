import fitz  # pymupdf
from typing import List, Dict
import asyncio
import uuid
import re

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

    def extract_metadata(self, pdf_path: str, fallback_name: str = "Uploaded paper") -> Dict[str, str]:
        """Extract a usable title and abstract-like summary from a PDF."""
        doc = fitz.open(pdf_path)
        metadata = doc.metadata or {}
        first_page = doc[0].get_text("text") if doc.page_count else ""
        doc.close()

        title = self._clean_metadata_value(metadata.get("title"))
        lines = [re.sub(r"\s+", " ", line).strip() for line in first_page.splitlines()]
        lines = [line for line in lines if line]
        if not title or self._looks_like_filename(title):
            title = self._title_from_first_page(lines) or self._clean_filename(fallback_name)

        abstract = self._abstract_from_first_page(lines, title)
        return {"title": title[:300], "abstract": abstract[:2000]}

    @staticmethod
    def _clean_metadata_value(value: str | None) -> str:
        return re.sub(r"\s+", " ", value or "").strip()

    @staticmethod
    def _clean_filename(filename: str) -> str:
        stem = re.sub(r"\.pdf$", "", filename, flags=re.IGNORECASE)
        stem = re.sub(r"[_-]+", " ", stem)
        return re.sub(r"\s+", " ", stem).strip() or "Uploaded paper"

    @staticmethod
    def _looks_like_filename(value: str) -> bool:
        return bool(re.fullmatch(r"[a-z0-9][a-z0-9._-]{4,}", value.strip(), re.IGNORECASE))

    @staticmethod
    def _title_from_first_page(lines: List[str]) -> str:
        candidates = []
        for line in lines[:20]:
            if (
                len(line) >= 15
                and len(line) <= 300
                and not re.search(
                    r"\b(abstract|keywords|issn|volume|received|copyright|review article|journal|doi)\b",
                    line,
                    re.IGNORECASE,
                )
                and not re.search(r"\b\d{4}\b|rsc\.li|https?://", line, re.IGNORECASE)
                and not re.search(r"@", line)
            ):
                candidates.append(line)
        return candidates[0] if candidates else ""

    @staticmethod
    def _abstract_from_first_page(lines: List[str], title: str) -> str:
        try:
            start = next(i for i, line in enumerate(lines) if line.lower() == "abstract")
            abstract_lines = []
            for line in lines[start + 1:]:
                if re.fullmatch(r"(keywords?|introduction)", line, re.IGNORECASE):
                    break
                abstract_lines.append(line)
            abstract = " ".join(abstract_lines)
            if len(abstract) >= 80:
                return abstract
        except StopIteration:
            pass

        content = " ".join(line for line in lines if line != title)
        return content[:2000]

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
        
        # Chroma collections created with an older embedding model can have a
        # different dimension. Keep the extracted chunks usable for analysis
        # and Q&A even when vector indexing is unavailable.
        try:
            vector_store.upsert_chunks(processed_chunks)
        except Exception as e:
            print(f"Vector indexing unavailable for uploaded PDF: {e}")

        return processed_chunks


pdf_processor = PDFProcessor()