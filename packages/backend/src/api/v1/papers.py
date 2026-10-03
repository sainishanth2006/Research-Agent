from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from sqlalchemy import text
import os
import uuid
import aiofiles

from src.api.deps import get_current_user, get_db, CurrentUser, DatabaseSession
from src.services.pdf_processor import pdf_processor
from src.services.paper_analysis import paper_analysis_service
from src.services.vector_store import vector_store

router = APIRouter()

UPLOAD_DIR = "/tmp/mrdu_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class PaperResponse(BaseModel):
    id: str
    external_id: str
    source: str
    title: str
    abstract: Optional[str]
    authors: List[str]
    year: Optional[int]
    venue: Optional[str]
    doi: Optional[str]
    url: Optional[str]
    pdf_url: Optional[str]
    citation_count: int
    reference_count: int
    topics: List[str]


class PaperAnalysisResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    paper_id: str = Field(alias="paperId")
    research_problem: dict = Field(alias="researchProblem")
    methodology: dict
    dataset: dict
    experiments: dict
    metrics: dict
    key_findings: List[dict] = Field(alias="keyFindings")
    contributions: List[dict]
    limitations: List[dict]
    future_work: List[dict] = Field(alias="futureWork")


@router.get("/{paper_id}", response_model=PaperResponse)
async def get_paper(
    paper_id: str,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    """Get a persisted paper by database ID or external ID."""
    result = await db.execute(
        text(
            """
            SELECT id, "externalId" AS external_id, source, title, abstract, authors,
                   year, venue, doi, url, "pdfUrl" AS pdf_url,
                   "citationCount" AS citation_count, "referenceCount" AS reference_count,
                   topics
            FROM "Paper"
            WHERE id = :paper_id OR "externalId" = :paper_id
            LIMIT 1
            """
        ),
        {"paper_id": paper_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Paper not found")
    return dict(row)


@router.get("/{paper_id}/analysis", response_model=PaperAnalysisResponse)
async def get_paper_analysis(
    paper_id: str,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    """Get structured analysis of a paper."""
    analysis = await paper_analysis_service.analyze_paper(paper_id)
    analysis["paperId"] = paper_id
    return analysis


class QARequest(BaseModel):
    question: str

@router.post("/{paper_id}/qa")
async def paper_qa(
    paper_id: str,
    request: QARequest,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    """Ask a question about a specific paper."""
    result = await paper_analysis_service.answer_question(paper_id, request.question)
    return result


@router.post("/upload")
async def upload_paper(
    current_user: CurrentUser,
    db: DatabaseSession,
    file: UploadFile = File(...),
):
    """Upload a PDF paper for processing."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
    
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # Process PDF (extract, chunk, embed, store)
    try:
        chunks = await pdf_processor.process_pdf(file_id, file_path)
        
        # Create paper record (simplified)
        paper_data = {
            "id": file_id,
            "external_id": file_id,
            "source": "upload",
            "title": os.path.splitext(file.filename)[0],
            "abstract": chunks[0]["content"][:500] if chunks else "",
            "authors": [],
            "year": None,
            "venue": "Uploaded PDF",
            "doi": None,
            "url": None,
            "pdf_url": None,
            "citation_count": 0,
            "reference_count": 0,
            "topics": [],
        }
        
        await db.execute(
            text(
                """
                INSERT INTO "Paper"
                    (id, "externalId", source, title, abstract, authors, venue, topics,
                     "createdAt", "updatedAt")
                VALUES (:id, :external_id, 'upload', :title, :abstract, ARRAY[]::text[],
                        'Uploaded PDF', ARRAY[]::text[], NOW(), NOW())
                ON CONFLICT ("externalId") DO UPDATE SET
                    title = EXCLUDED.title, abstract = EXCLUDED.abstract,
                    "updatedAt" = NOW()
                """
            ),
            {
                "id": file_id,
                "external_id": file_id,
                "title": paper_data["title"],
                "abstract": paper_data["abstract"],
            },
        )
        for chunk in chunks:
            await db.execute(
                text(
                    """
                    INSERT INTO "PaperChunk"
                        (id, "paperId", "chunkIndex", content, "tokenCount", "chromaId", "createdAt")
                    VALUES (:id, :paper_id, :chunk_index, :content, :token_count, :chroma_id, NOW())
                    ON CONFLICT ("chromaId") DO NOTHING
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "paper_id": file_id,
                    "chunk_index": chunk["chunk_index"],
                    "content": chunk["content"],
                    "token_count": chunk["token_count"],
                    "chroma_id": chunk["chroma_id"],
                },
            )

        return {"paper": paper_data, "chunks_processed": len(chunks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@router.get("/{paper_id}/chunks")
async def get_paper_chunks(
    paper_id: str,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    """Get paper chunks for RAG."""
    chunks = vector_store.get_chunks(paper_id)
    return {"chunks": chunks}