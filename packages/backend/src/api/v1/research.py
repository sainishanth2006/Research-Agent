from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db, CurrentUser, DatabaseSession
from src.services.timeline import timeline_service
from src.services.comparison import comparison_service
from src.services.gaps import gaps_service

router = APIRouter()


# Timeline
class TimelineRequest(BaseModel):
    paper_id: str
    limit: int = 10

class TimelineResponse(BaseModel):
    before: List[dict]
    after: List[dict]

@router.post("/timeline/before-after", response_model=TimelineResponse)
async def get_before_after(
    request: TimelineRequest,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    """Get papers before and after a given paper."""
    # Fetch paper details
    from sqlalchemy import text
    result = await db.execute(text(
        'SELECT id, "externalId", year, abstract FROM "Paper" WHERE id = :pid'
    ), {"pid": request.paper_id})
    row = result.mappings().first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = dict(row)
    result = await timeline_service.get_before_after(
        db, paper["id"], paper["year"] or 0, paper["abstract"] or ""
    )
    return result


# Comparison
class ComparisonRequest(BaseModel):
    paper_ids: List[str]

@router.post("/comparison")
async def compare_papers(
    request: ComparisonRequest,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    """Compare multiple papers."""
    if len(request.paper_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 papers required")
    
    result = await comparison_service.compare_papers(db, request.paper_ids)
    return result


# Research Gaps
class GapsRequest(BaseModel):
    query: str
    paper_ids: List[str]

@router.post("/gaps")
async def find_gaps(
    request: GapsRequest,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    """Identify research gaps from a set of papers."""
    gaps = await gaps_service.identify_gaps_from_search(db, request.query, request.paper_ids)
    return {"gaps": gaps}