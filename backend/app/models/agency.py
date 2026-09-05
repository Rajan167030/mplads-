from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin


class Agency(UUIDPKMixin, TimestampMixin, Base):
    """Implementing agency responsible for on-ground execution of a project."""

    __tablename__ = "agencies"

    external_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    level: Mapped[str | None] = mapped_column(String(32), nullable=True)  # CENTRAL | STATE | DISTRICT
    state: Mapped[str | None] = mapped_column(String(128), nullable=True)
    district: Mapped[str | None] = mapped_column(String(128), nullable=True)
