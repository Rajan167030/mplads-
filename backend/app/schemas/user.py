import uuid
from datetime import datetime

from pydantic import BaseModel


class UserCreate(BaseModel):
    email: str
    full_name: str
    password: str
    role: str  # MP | DISTRICT_AUTHORITY | STATE_NODAL | MINISTRY
    scope_value: str | None = None  # constituency/district/state matching Project columns; None for MINISTRY


class UserUpdate(BaseModel):
    role: str | None = None
    scope_value: str | None = None
    is_active: bool | None = None


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    scope_value: str | None
    is_active: bool
    created_at: datetime
