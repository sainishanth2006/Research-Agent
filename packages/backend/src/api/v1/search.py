from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy import text
import json
import uuid

from src.api.deps import CurrentUser, DatabaseSession
from src.services.search import search_service

router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    expanded_terms: Optional[List[str]] = None
    filters: Optional[dict] = None
    limit: int = 20


class SearchResponse(BaseModel):
    results: List[dict]
    total: int
    query: str
    expanded_terms: List[str]


class ExpandRequest(BaseModel):
    query: str


async def _persist_papers(db, papers: List[dict]) -> None:
    for paper in papers:
        external_id = paper.get("external_id")
        if not external_id:
            continue
        await db.execute(
            text(
                """
                INSERT INTO "Paper"
                    (id, "externalId", source, title, abstract, authors, year, venue,
                     doi, url, "pdfUrl", "citationCount", "referenceCount", topics,
                     "createdAt", "updatedAt")
                VALUES
                    (:id, :external_id, :source, :title, :abstract, :authors, :year, :venue,
                     :doi, :url, :pdf_url, :citation_count, :reference_count, :topics,
                     NOW(), NOW())
                ON CONFLICT ("externalId") DO UPDATE SET
                    title = EXCLUDED.title, abstract = EXCLUDED.abstract,
                    authors = EXCLUDED.authors, year = EXCLUDED.year,
                    venue = EXCLUDED.venue, doi = EXCLUDED.doi, url = EXCLUDED.url,
                    "pdfUrl" = EXCLUDED."pdfUrl", topics = EXCLUDED.topics,
                    "updatedAt" = NOW()
                """
            ),
            {
                "id": external_id,
                "external_id": external_id,
                "source": paper.get("source", "unknown"),
                "title": paper.get("title", "Untitled paper"),
                "abstract": paper.get("abstract"),
                "authors": paper.get("authors", []),
                "year": paper.get("year"),
                "venue": paper.get("venue"),
                "doi": paper.get("doi"),
                "url": paper.get("url"),
                "pdf_url": paper.get("pdf_url"),
                "citation_count": paper.get("citation_count", 0),
                "reference_count": paper.get("reference_count", 0),
                "topics": paper.get("topics", []),
            },
        )


@router.post("", response_model=SearchResponse)
async def search_papers(
    request: SearchRequest,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    """Hybrid search for papers."""
    results = await search_service.hybrid_search(db, request.query, request.limit)
    await _persist_papers(db, results)

    await db.execute(
        text(
            """
            INSERT INTO "SearchHistory"
                (id, "userId", query, filters, "resultCount", "createdAt")
            VALUES (:id, :user_id, :query, CAST(:filters AS jsonb), :result_count, NOW())
            """
        ),
        {
            "id": str(uuid.uuid4()),
            "user_id": current_user.sub,
            "query": request.query,
            "filters": json.dumps(request.filters or {}),
            "result_count": len(results),
        },
    )
    
    # Extract expanded terms
    expanded = []
    if results:
        # The search service returns expanded terms internally
        expanded = await search_service.expand_query(request.query)
    
    return SearchResponse(
        results=results,
        total=len(results),
        query=request.query,
        expanded_terms=expanded,
    )


@router.get("/history")
async def search_history(
    current_user: CurrentUser,
    db: DatabaseSession,
    limit: int = 50,
):
    result = await db.execute(
        text(
            """
            SELECT id, query, filters, "resultCount" AS result_count,
                   "createdAt" AS created_at
            FROM "SearchHistory"
            WHERE "userId" = :user_id
            ORDER BY "createdAt" DESC
            LIMIT :limit
            """
        ),
        {"user_id": current_user.sub, "limit": min(max(limit, 1), 100)},
    )
    return {"history": [dict(row) for row in result.mappings()]}


@router.post("/expand")
async def expand_query(
    request: ExpandRequest,
    current_user: CurrentUser,
):
    """Expand a research query into related search terms."""
    expanded = await search_service.expand_query(request.query)
    return {
        "original_query": request.query,
        "expanded_terms": expanded,
    }