from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import json
import uuid

from src.api.deps import get_current_user, get_db, CurrentUser, DatabaseSession
from src.services.llm import llm_service

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "tool"
    content: str
    tool_calls: Optional[List[dict]] = None
    tool_results: Optional[List[dict]] = None
    citations: Optional[List[dict]] = None


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    context: Optional[dict] = None  # papers, search results, etc.


class ChatResponse(BaseModel):
    message: ChatMessage
    conversation_id: str


class ConversationCreate(BaseModel):
    title: str
    project_id: Optional[str] = None
    context: Optional[dict] = None
    initial_messages: Optional[List[ChatMessage]] = None


class ConversationResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    context: Optional[dict] = None


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    """Answer a follow-up question using the stored conversation and research context."""
    conversation_id = request.conversation_id
    context = request.context or {}

    if conversation_id:
        conversation = await db.execute(
            text('SELECT id, context FROM "Conversation" WHERE id = :id AND "userId" = :user_id'),
            {"id": conversation_id, "user_id": current_user.sub},
        )
        row = conversation.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Conversation not found")
        stored_context = row["context"] or {}
        if isinstance(stored_context, str):
            stored_context = json.loads(stored_context)
        merged_context = {**stored_context, **context}
    else:
        conversation_id = str(uuid.uuid4())
        merged_context = context
        await db.execute(
            text(
                """
                INSERT INTO "Conversation" (id, "userId", title, context, "createdAt", "updatedAt")
                VALUES (:id, :user_id, :title, CAST(:context AS jsonb), NOW(), NOW())
                """
            ),
            {
                "id": conversation_id,
                "user_id": current_user.sub,
                "title": request.message[:80],
                "context": json.dumps(merged_context),
            },
        )

    history_result = await db.execute(
        text(
            """
            SELECT role, content
            FROM "ConversationMessage"
            WHERE "conversationId" = :conversation_id
            ORDER BY "createdAt" DESC
            LIMIT 12
            """
        ),
        {"conversation_id": conversation_id},
    )
    history = list(reversed([dict(row) for row in history_result.mappings()]))
    papers = merged_context.get("papers", [])[:8]
    paper_context = "\n".join(
        f"{index + 1}. {paper.get('title', 'Untitled')} ({paper.get('year', 'n.d.')}) - "
        f"{(paper.get('abstract') or '')[:700]}"
        for index, paper in enumerate(papers)
    )
    prompt = f"""You are a research assistant, not just a paper retriever.
Answer the user's follow-up question using the conversation and papers below.
Be precise, explain your reasoning, and say when the provided papers do not contain enough evidence.
Use paper titles as inline citations when making claims.

Conversation:
{json.dumps(history)}

Research context:
{paper_context or "No papers have been selected yet."}

User question: {request.message}
"""
    try:
        answer = await llm_service.generate(prompt, timeout=20)
    except Exception:
        answer = _fallback_answer(request.message, papers)

    await db.execute(
        text(
            """
            INSERT INTO "ConversationMessage" (id, "conversationId", role, content, "createdAt")
            VALUES (:id, :conversation_id, :role, :content, NOW())
            """
        ),
        {"id": str(uuid.uuid4()), "conversation_id": conversation_id, "role": "user", "content": request.message},
    )
    await db.execute(
        text(
            """
            INSERT INTO "ConversationMessage" (id, "conversationId", role, content, "createdAt")
            VALUES (:id, :conversation_id, :role, :content, NOW())
            """
        ),
        {"id": str(uuid.uuid4()), "conversation_id": conversation_id, "role": "assistant", "content": answer},
    )
    await db.execute(
        text(
            """
            UPDATE "Conversation"
            SET context = CAST(:context AS jsonb), "updatedAt" = NOW()
            WHERE id = :conversation_id AND "userId" = :user_id
            """
        ),
        {
            "context": json.dumps(merged_context),
            "conversation_id": conversation_id,
            "user_id": current_user.sub,
        },
    )

    return ChatResponse(
        message=ChatMessage(
            role="assistant",
            content=answer,
        ),
        conversation_id=conversation_id,
    )


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    request: ConversationCreate,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    conversation_id = str(uuid.uuid4())
    result = await db.execute(
        text(
            """
            INSERT INTO "Conversation" (id, "userId", "projectId", title, context, "createdAt", "updatedAt")
            VALUES (:id, :user_id, :project_id, :title, CAST(:context AS jsonb), NOW(), NOW())
            RETURNING id, title, "createdAt" AS created_at, "updatedAt" AS updated_at
            """
        ),
        {
            "id": conversation_id,
            "user_id": current_user.sub,
            "project_id": request.project_id,
            "title": request.title,
            "context": json.dumps(request.context or {}),
        },
    )
    row = result.mappings().one()
    for message in request.initial_messages or []:
        await db.execute(
            text(
                """
                INSERT INTO "ConversationMessage" (id, "conversationId", role, content, "createdAt")
                VALUES (:id, :conversation_id, :role, :content, NOW())
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "conversation_id": conversation_id,
                "role": message.role,
                "content": message.content,
            },
        )
    return ConversationResponse(**{**dict(row), "created_at": row["created_at"].isoformat(), "updated_at": row["updated_at"].isoformat()})


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    current_user: CurrentUser,
    db: DatabaseSession,
    project_id: Optional[str] = None,
):
    result = await db.execute(
        text(
            """
            SELECT id, title, context, "createdAt" AS created_at, "updatedAt" AS updated_at
            FROM "Conversation"
            WHERE "userId" = :user_id
              AND (CAST(:project_id AS text) IS NULL OR "projectId" = CAST(:project_id AS text))
            ORDER BY "updatedAt" DESC
            """
        ),
        {"user_id": current_user.sub, "project_id": project_id},
    )
    return [
        ConversationResponse(
            **{
                **dict(row),
                "created_at": row["created_at"].isoformat(),
                "updated_at": row["updated_at"].isoformat(),
            }
        )
        for row in result.mappings()
    ]


@router.get("/conversations/{conversation_id}/messages", response_model=List[ChatMessage])
async def get_conversation_messages(
    conversation_id: str,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    ownership = await db.execute(
        text('SELECT 1 FROM "Conversation" WHERE id = :id AND "userId" = :user_id'),
        {"id": conversation_id, "user_id": current_user.sub},
    )
    if not ownership.first():
        raise HTTPException(status_code=404, detail="Conversation not found")
    result = await db.execute(
        text(
            """
            SELECT role, content, "toolCalls" AS tool_calls, "toolResults" AS tool_results, citations
            FROM "ConversationMessage"
            WHERE "conversationId" = :conversation_id
            ORDER BY "createdAt" ASC
            """
        ),
        {"conversation_id": conversation_id},
    )
    return [ChatMessage(**dict(row)) for row in result.mappings()]


def _fallback_answer(question: str, papers: List[dict]) -> str:
    """Provide a useful answer when no LLM key is configured."""
    if not papers:
        return "I do not have research papers in context yet. Run a search first, then ask your follow-up question."
    titles = ", ".join(paper.get("title", "Untitled") for paper in papers[:3])
    return (
        f"I found {len(papers)} papers in the current context. For your question "
        f"('{question}'), the most relevant papers are: {titles}. "
        "Gemini is currently unavailable, so I cannot synthesize a deeper answer yet; "
        "the papers and conversation context have been saved for the next response."
    )