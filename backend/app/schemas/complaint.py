import uuid
from datetime import datetime

from pydantic import BaseModel


class ComplaintSubmitOut(BaseModel):
    token: str
    status: str
    is_location_verified: bool
    distance_to_project_m: float | None
    message: str


class ComplaintStatusOut(BaseModel):
    token: str
    status: str
    is_location_verified: bool
    distance_to_project_m: float | None
    project_name: str
    created_at: datetime


class ComplaintListItem(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    project_name: str
    project_external_id: str
    description: str
    is_location_verified: bool
    distance_to_project_m: float | None
    status: str
    created_at: datetime


class ComplaintDetailOut(ComplaintListItem):
    submitted_latitude: float
    submitted_longitude: float
    resolution_notes: str | None
    updated_at: datetime


class ComplaintUpdate(BaseModel):
    status: str | None = None
    resolution_notes: str | None = None
