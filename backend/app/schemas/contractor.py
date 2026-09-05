import uuid

from pydantic import BaseModel


class ContractorListItem(BaseModel):
    id: uuid.UUID
    name: str
    state: str | None
    district: str | None
    total_projects: int
    completed_projects: int
    delayed_projects: int
    high_risk_projects: int
    average_cost_overrun: float | None
    average_delay_days: float | None
    risk_score: float | None


class ContractorListOut(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[ContractorListItem]


class ContractorProjectItem(BaseModel):
    id: uuid.UUID
    external_project_id: str
    project_name: str
    state: str
    district: str
    status: str
    sanctioned_amount: float
    risk_score: float | None
    risk_band: str | None


class ContractorDetailOut(BaseModel):
    contractor: ContractorListItem
    projects: list[ContractorProjectItem]
