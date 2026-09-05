import uuid

from pydantic import BaseModel


class RiskScoringRunOut(BaseModel):
    projects_scored: int
    band_counts: dict[str, int]


class RiskSummaryOut(BaseModel):
    total_projects_scored: int
    band_counts: dict[str, int]
    total_risk_signals: int
    open_investigations: int


class ProjectRiskSummary(BaseModel):
    id: uuid.UUID
    external_project_id: str
    project_name: str
    state: str
    district: str
    project_type: str
    status: str
    risk_score: float | None
    risk_band: str | None


class ContributingSignal(BaseModel):
    signal_type: str
    source: str
    severity: str
    score: float
    confidence: float
    weighted_contribution: float
    description: str


class RiskExplanationOut(BaseModel):
    project: ProjectRiskSummary
    contributing_signals: list[ContributingSignal]
    narrative_reasons: list[str]
    recommended_verification: list[str]
    overall_confidence: float
