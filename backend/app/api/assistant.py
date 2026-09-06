import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.audit import log_audit_event
from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.assistant_conversation import AssistantConversation
from app.models.assistant_message import AssistantMessage
from app.models.enums import MessageRole
from app.models.user import User
from app.schemas.assistant import (
    AssistantQueryRequest,
    AssistantQueryResponse,
    AssistantStatusOut,
    ConversationDetailOut,
    ConversationOut,
    CreateConversationRequest,
    DocumentUploadResponse,
    MessageOut,
    SendMessageRequest,
    SendMessageResponse,
)
from app.services.assistant import answer_in_conversation, answer_question
from app.services.document_extraction import UnsupportedDocumentTypeError, extract_text

router = APIRouter(prefix="/assistant", tags=["assistant"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB


@router.get("/status", response_model=AssistantStatusOut)
def assistant_status() -> AssistantStatusOut:
    settings = get_settings()
    return AssistantStatusOut(configured=bool(settings.llm_api_key) and settings.llm_provider != "none", provider=settings.llm_provider)


@router.post("/query", response_model=AssistantQueryResponse)
def query_assistant(payload: AssistantQueryRequest, db: Session = Depends(get_db)) -> AssistantQueryResponse:
    """Stateless one-shot query — kept for backward compatibility. New usage
    should go through the conversation endpoints below, which persist
    history and support document context."""
    result = answer_question(db, payload.question, payload.project_id)
    if result.error == "Project not found":
        raise HTTPException(status_code=404, detail="Project not found")

    return AssistantQueryResponse(
        llm_configured=result.llm_configured,
        answer=result.answer,
        context_summary=result.context_summary,
        grounded_on=result.grounded_on,
        error=result.error,
    )


def _get_owned_conversation(db: Session, conversation_id: str, user: User) -> AssistantConversation:
    conversation = db.get(AssistantConversation, conversation_id)
    if not conversation or conversation.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def _conversation_out(c: AssistantConversation) -> ConversationOut:
    return ConversationOut(
        id=c.id, title=c.title, project_id=c.project_id,
        document_filename=c.document_filename, created_at=c.created_at, updated_at=c.updated_at,
    )


def _message_out(m: AssistantMessage) -> MessageOut:
    return MessageOut(id=m.id, role=m.role.value, content=m.content, grounded_on=m.grounded_on, created_at=m.created_at)


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[ConversationOut]:
    conversations = (
        db.query(AssistantConversation)
        .filter(AssistantConversation.user_id == user.id)
        .order_by(AssistantConversation.updated_at.desc())
        .all()
    )
    return [_conversation_out(c) for c in conversations]


@router.post("/conversations", response_model=ConversationOut)
def create_conversation(
    payload: CreateConversationRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> ConversationOut:
    conversation = AssistantConversation(
        user_id=user.id, project_id=uuid.UUID(payload.project_id) if payload.project_id else None
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    log_audit_event(db, user.id, "CREATE_CONVERSATION", "AssistantConversation", conversation.id)
    return _conversation_out(conversation)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailOut)
def get_conversation(
    conversation_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> ConversationDetailOut:
    conversation = _get_owned_conversation(db, conversation_id, user)
    return ConversationDetailOut(
        **_conversation_out(conversation).model_dump(),
        messages=[_message_out(m) for m in conversation.messages],
    )


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    conversation = _get_owned_conversation(db, conversation_id, user)
    db.delete(conversation)
    db.commit()


@router.post("/conversations/{conversation_id}/messages", response_model=SendMessageResponse)
def send_message(
    conversation_id: str, payload: SendMessageRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> SendMessageResponse:
    conversation = _get_owned_conversation(db, conversation_id, user)

    user_message = AssistantMessage(conversation_id=conversation.id, role=MessageRole.USER, content=payload.content)
    db.add(user_message)
    db.flush()

    result = answer_in_conversation(db, conversation, payload.content)
    answer_text = result.answer or (result.error or "No response available.")

    assistant_message = AssistantMessage(
        conversation_id=conversation.id, role=MessageRole.ASSISTANT, content=answer_text, grounded_on=result.grounded_on
    )
    db.add(assistant_message)

    if conversation.title == "New conversation":
        conversation.title = payload.content[:60] + ("…" if len(payload.content) > 60 else "")

    db.commit()
    db.refresh(user_message)
    db.refresh(assistant_message)

    log_audit_event(db, user.id, "ASK_ASSISTANT", "AssistantConversation", conversation.id, {"question": payload.content[:200]})

    return SendMessageResponse(
        user_message=_message_out(user_message),
        assistant_message=_message_out(assistant_message),
        llm_configured=result.llm_configured,
        error=result.error,
    )


@router.post("/conversations/{conversation_id}/document", response_model=DocumentUploadResponse)
async def upload_document(
    conversation_id: str, file: UploadFile, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> DocumentUploadResponse:
    conversation = _get_owned_conversation(db, conversation_id, user)

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large — 10MB limit.")

    try:
        text = extract_text(file.filename or "upload", content)
    except UnsupportedDocumentTypeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not text:
        raise HTTPException(status_code=422, detail="No extractable text found in this document (scanned/image-only PDFs aren't supported).")

    conversation.document_filename = file.filename
    conversation.document_text = text
    db.commit()

    log_audit_event(db, user.id, "UPLOAD_ASSISTANT_DOCUMENT", "AssistantConversation", conversation.id, {"filename": file.filename})

    return DocumentUploadResponse(filename=file.filename or "upload", characters_extracted=len(text))
