from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.schemas.assistant import AssistantQueryRequest, AssistantQueryResponse, AssistantStatusOut
from app.services.assistant import answer_question

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.get("/status", response_model=AssistantStatusOut)
def assistant_status() -> AssistantStatusOut:
    settings = get_settings()
    return AssistantStatusOut(configured=bool(settings.llm_api_key) and settings.llm_provider != "none", provider=settings.llm_provider)


@router.post("/query", response_model=AssistantQueryResponse)
def query_assistant(payload: AssistantQueryRequest, db: Session = Depends(get_db)) -> AssistantQueryResponse:
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
