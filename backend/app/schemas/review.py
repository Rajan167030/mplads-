import uuid
from datetime import datetime

from pydantic import BaseModel


class ReviewCreate(BaseModel):
    verdict: str  # APPROVE | REJECT | NEEDS_MORE_INFO | ESCALATE
    findings: str
    recommendation: str | None = None
    evidence_references: str | None = None


class ReviewOut(BaseModel):
    id: uuid.UUID
    investigation_id: uuid.UUID
    reviewer_id: uuid.UUID
    reviewer_name: str
    reviewer_role: str
    verdict: str
    findings: str
    recommendation: str | None
    evidence_references: str | None
    created_at: datetime
    updated_at: datetime
