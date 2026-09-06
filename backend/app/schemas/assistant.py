import uuid
from datetime import datetime

from pydantic import BaseModel


class AssistantQueryRequest(BaseModel):
    question: str
    project_id: str | None = None


class AssistantQueryResponse(BaseModel):
    llm_configured: bool
    answer: str | None
    context_summary: str
    grounded_on: dict
    error: str | None = None


class AssistantStatusOut(BaseModel):
    configured: bool
    provider: str


# ---------------------------------------------------------------------------
# Conversations (chat history, document upload)
# ---------------------------------------------------------------------------


class MessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    grounded_on: dict | None
    created_at: datetime


class ConversationOut(BaseModel):
    id: uuid.UUID
    title: str
    project_id: uuid.UUID | None
    document_filename: str | None
    created_at: datetime
    updated_at: datetime


class ConversationDetailOut(ConversationOut):
    messages: list[MessageOut]


class CreateConversationRequest(BaseModel):
    project_id: str | None = None


class SendMessageRequest(BaseModel):
    content: str


class SendMessageResponse(BaseModel):
    user_message: MessageOut
    assistant_message: MessageOut
    llm_configured: bool
    error: str | None = None


class DocumentUploadResponse(BaseModel):
    filename: str
    characters_extracted: int
