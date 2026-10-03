from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db, CurrentUser, DatabaseSession

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


class ConversationResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    """
    Conversational research agent endpoint.
    Placeholder for Phase 4.
    """
    # TODO: Implement agent with tools
    return ChatResponse(
        message=ChatMessage(
            role="assistant",
            content="Chat agent not yet implemented. This will be built in Phase 4.",
        ),
        conversation_id="new-conversation",
    )


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    request: ConversationCreate,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    """Create a new conversation. Placeholder."""
    return ConversationResponse(
        id="new-conv-id",
        title=request.title,
        created_at="2024-01-01T00:00:00Z",
        updated_at="2024-01-01T00:00:00Z",
    )


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    current_user: CurrentUser,
    db: DatabaseSession,
    project_id: Optional[str] = None,
):
    """List user's conversations. Placeholder."""
    return []


@router.get("/conversations/{conversation_id}/messages", response_model=List[ChatMessage])
async def get_conversation_messages(
    conversation_id: str,
    current_user: CurrentUser,
    db: DatabaseSession,
):
    """Get messages for a conversation. Placeholder."""
    return []