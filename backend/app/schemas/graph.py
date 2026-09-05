import uuid

from pydantic import BaseModel


class ProjectRef(BaseModel):
    id: uuid.UUID
    external_project_id: str
    project_name: str
    state: str
    district: str
    project_type: str
    status: str
    risk_score: float | None
    risk_band: str | None


class RelatedProjectOut(BaseModel):
    project: ProjectRef
    relationship_types: list[str]
    distance_km: float | None


class NearbyProjectOut(BaseModel):
    project: ProjectRef
    distance_km: float


class ContractorRef(BaseModel):
    id: uuid.UUID
    name: str
    total_projects: int
    delayed_projects: int
    high_risk_projects: int
    risk_score: float | None


class ContractorNetworkEntryOut(BaseModel):
    contractor: ContractorRef
    shared_context_count: int
    contexts: list[list[str]]


class GraphNode(BaseModel):
    id: uuid.UUID
    label: str
    risk_score: float | None
    total_projects: int
    high_risk_projects: int


class GraphEdge(BaseModel):
    source: uuid.UUID
    target: uuid.UUID
    weight: int
    contexts: list[list[str]]


class OverviewGraphOut(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
