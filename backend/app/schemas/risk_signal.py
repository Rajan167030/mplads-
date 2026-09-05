import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class RiskSignalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    signal_type: str
    source: str
    severity: str
    score: float
    confidence: float
    description: str
    evidence: dict
    created_at: datetime


class RuleEngineRunOut(BaseModel):
    projects_scanned: int
    signals_created: int
    by_type: dict[str, int]
