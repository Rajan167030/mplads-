import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EntityMatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_project_id: uuid.UUID
    matched_project_id: uuid.UUID
    match_confidence: float
    verdict: str
    matching_features: dict
    created_at: datetime


class EntityResolutionRunOut(BaseModel):
    embeddings_computed: int
    projects_considered: int
    pairs_evaluated: int
    matches: int
    possible_matches: int
