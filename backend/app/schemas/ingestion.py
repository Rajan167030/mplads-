import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class IngestionReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_filename: str
    created_at: datetime

    records_received: int
    valid: int
    invalid: int

    missing_location: int
    missing_contractor: int
    missing_amount: int

    duplicate_candidates: int
    entity_matches: int
    uncertain_matches: int

    language_distribution: dict
    validation_errors: list
