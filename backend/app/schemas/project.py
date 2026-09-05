import uuid
from datetime import date, datetime


from pydantic import BaseModel


class ProjectListItem(BaseModel):
    id: uuid.UUID
    external_project_id: str
    project_name: str
    project_type: str
    state: str
    district: str
    status: str
    sanctioned_amount: float
    physical_progress: float
    financial_progress: float
    contractor_name: str | None
    risk_score: float | None
    risk_band: str | None


class ProjectListOut(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[ProjectListItem]


class ProjectDetailOut(BaseModel):
    id: uuid.UUID
    external_project_id: str
    project_name: str
    description: str | None
    language: str | None
    project_type: str
    state: str
    district: str
    constituency: str | None
    latitude: float | None
    longitude: float | None
    sanctioned_amount: float
    estimated_cost: float
    released_amount: float
    expenditure_amount: float
    start_date: date
    expected_completion_date: date
    actual_completion_date: date | None
    physical_progress: float
    financial_progress: float
    status: str
    contractor_id: uuid.UUID | None
    contractor_name: str | None
    implementing_agency_id: uuid.UUID | None
    implementing_agency_name: str | None
    risk_score: float | None
    risk_band: str | None
    signal_count: int


class PaymentOut(BaseModel):
    id: uuid.UUID
    amount: float
    payment_date: date
    payment_type: str
    payment_status: str
    recipient: str | None


class MilestoneOut(BaseModel):
    id: uuid.UUID
    name: str
    expected_date: date
    actual_date: date | None
    expected_progress: float
    actual_progress: float | None
    status: str


class InspectionOut(BaseModel):
    id: uuid.UUID
    inspection_date: date
    inspector: str | None
    reported_progress: float
    remarks: str | None


class EvidenceOut(BaseModel):
    id: uuid.UUID
    type: str
    file_reference: str | None
    description: str | None
    captured_at: datetime | None
    source: str | None


class ProjectTimelineOut(BaseModel):
    payments: list[PaymentOut]
    milestones: list[MilestoneOut]
    inspections: list[InspectionOut]
    evidence: list[EvidenceOut]
