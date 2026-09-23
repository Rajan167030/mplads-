import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ProjectSummaryForMatch(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    external_project_id: str
    project_name: str
    description: str | None = None
    project_type: str
    state: str
    district: str
    constituency: str | None = None
    mp_name: str | None = None
    sanctioned_amount: float
    released_amount: float
    expenditure_amount: float
    start_date: date
    expected_completion_date: date
    actual_completion_date: date | None = None
    physical_progress: float
    financial_progress: float
    status: str
    contractor_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    risk_score: float | None = None
    risk_band: str | None = None


class MatchDifferenceMetrics(BaseModel):
    amount_diff_inr: float
    amount_diff_pct: float
    days_between_sanction: int
    same_contractor: bool
    same_mp: bool
    distance_km: float | None = None


class EntityMatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_project_id: uuid.UUID
    matched_project_id: uuid.UUID
    match_confidence: float
    verdict: str
    matching_features: dict[str, Any]
    created_at: datetime


class EntityMatchEnrichedOut(EntityMatchOut):
    source_project: ProjectSummaryForMatch
    matched_project: ProjectSummaryForMatch
    diff_metrics: MatchDifferenceMetrics


class EntityResolutionRunOut(BaseModel):
    embeddings_computed: int
    projects_considered: int
    pairs_evaluated: int
    matches: int
    possible_matches: int

