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
