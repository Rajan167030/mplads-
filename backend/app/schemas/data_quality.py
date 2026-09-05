import uuid
from datetime import datetime

from pydantic import BaseModel


class DataQualityOut(BaseModel):
    latest_ingestion_report_id: uuid.UUID | None
    latest_ingestion_at: datetime | None

    total_projects: int
    records_processed: int
    invalid_records: int

    missing_location: int
    missing_contractor_text: int
    missing_contractor_link: int
    missing_amount: int
    projects_without_payments: int

    duplicate_candidates: int
    entity_matches: int
    uncertain_matches: int
    average_entity_match_confidence: float | None

    language_distribution: dict
