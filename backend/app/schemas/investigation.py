import uuid
from datetime import datetime

from pydantic import BaseModel


class InvestigationCreate(BaseModel):
    project_id: uuid.UUID
    priority: str  # LOW | MEDIUM | HIGH | CRITICAL
    assigned_to: uuid.UUID | None = None
    notes: str | None = None


class InvestigationUpdate(BaseModel):
    status: str | None = None  # OPEN | IN_PROGRESS | RESOLVED
    priority: str | None = None
    assigned_to: uuid.UUID | None = None
    notes: str | None = None
    resolution: str | None = None  # LEGITIMATE | NEEDS_FURTHER_INVESTIGATION | ISSUE_CONFIRMED | INSUFFICIENT_DATA


class InvestigationOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    project_name: str
    project_external_id: str
    priority: str
    status: str
    assigned_to: uuid.UUID | None
    assigned_to_name: str | None
    notes: str | None
    resolution: str | None
    created_at: datetime
    updated_at: datetime
