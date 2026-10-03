from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy import text
import uuid

from src.api.deps import get_current_user, get_db, CurrentUser, DatabaseSession

router = APIRouter()


class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None


class CollectionResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    color: Optional[str]
    paper_count: int
    created_at: str
    updated_at: str


class CollectionPaperAdd(BaseModel):
    paper_id: str
    notes: Optional[str] = None


@router.post("", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection(
    request: CollectionCreate,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    collection_id = str(uuid.uuid4())
    result = await db.execute(
        text(
            """
            INSERT INTO "Collection" (id, "userId", name, description, color, "createdAt", "updatedAt")
            VALUES (:id, :user_id, :name, :description, :color, NOW(), NOW())
            RETURNING id, name, description, color, "createdAt" AS created_at,
                      "updatedAt" AS updated_at
            """
        ),
        {"id": collection_id, "user_id": current_user.sub, **request.model_dump()},
    )
    row = dict(result.mappings().one())
    row["paper_count"] = 0
    return row


@router.get("", response_model=List[CollectionResponse])
async def list_collections(
    current_user: CurrentUser,
    db: DatabaseSession,
):
    result = await db.execute(
        text(
            """
            SELECT c.id, c.name, c.description, c.color,
                   COUNT(cp.id)::int AS paper_count,
                   c."createdAt" AS created_at, c."updatedAt" AS updated_at
            FROM "Collection" c
            LEFT JOIN "CollectionPaper" cp ON cp."collectionId" = c.id
            WHERE c."userId" = :user_id
            GROUP BY c.id
            ORDER BY c."updatedAt" DESC
            """
        ),
        {"user_id": current_user.sub},
    )
    return [dict(row) for row in result.mappings()]


@router.get("/{collection_id}", response_model=CollectionResponse)
async def get_collection(
    collection_id: str,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    result = await db.execute(
        text(
            """
            SELECT c.id, c.name, c.description, c.color,
                   COUNT(cp.id)::int AS paper_count,
                   c."createdAt" AS created_at, c."updatedAt" AS updated_at
            FROM "Collection" c
            LEFT JOIN "CollectionPaper" cp ON cp."collectionId" = c.id
            WHERE c.id = :id AND c."userId" = :user_id
            GROUP BY c.id
            """
        ),
        {"id": collection_id, "user_id": current_user.sub},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Collection not found")
    return dict(row)


@router.post("/{collection_id}/papers")
async def add_paper_to_collection(
    collection_id: str,
    request: CollectionPaperAdd,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    ownership = await db.execute(
        text('SELECT id FROM "Collection" WHERE id = :id AND "userId" = :user_id'),
        {"id": collection_id, "user_id": current_user.sub},
    )
    if not ownership.first():
        raise HTTPException(status_code=404, detail="Collection not found")
    paper = await db.execute(
        text('SELECT id FROM "Paper" WHERE id = :id OR "externalId" = :id'),
        {"id": request.paper_id},
    )
    paper_row = paper.first()
    if not paper_row:
        raise HTTPException(status_code=404, detail="Paper not found")
    await db.execute(
        text(
            """
            INSERT INTO "CollectionPaper" (id, "collectionId", "paperId", "addedAt", notes)
            VALUES (:id, :collection_id, :paper_id, NOW(), :notes)
            ON CONFLICT ("collectionId", "paperId") DO UPDATE SET notes = EXCLUDED.notes
            """
        ),
        {"id": str(uuid.uuid4()), "collection_id": collection_id, "paper_id": paper_row[0], "notes": request.notes},
    )
    return {"message": "Paper added to collection"}


@router.delete("/{collection_id}/papers/{paper_id}")
async def remove_paper_from_collection(
    collection_id: str,
    paper_id: str,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    result = await db.execute(
        text(
            """
            DELETE FROM "CollectionPaper" cp USING "Collection" c, "Paper" p
            WHERE cp."collectionId" = c.id AND cp."paperId" = p.id
              AND cp."collectionId" = :collection_id
              AND (cp."paperId" = :paper_id OR p."externalId" = :paper_id)
              AND c."userId" = :user_id
            """
        ),
        {"collection_id": collection_id, "paper_id": paper_id, "user_id": current_user.sub},
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Collection paper not found")
    return {"message": "Paper removed from collection"}


@router.delete("/{collection_id}")
async def delete_collection(
    collection_id: str,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    result = await db.execute(
        text('DELETE FROM "Collection" WHERE id = :id AND "userId" = :user_id'),
        {"id": collection_id, "user_id": current_user.sub},
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Collection not found")
    return {"message": "Collection deleted"}