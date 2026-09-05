import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin


class Inspection(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "inspections"

    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), index=True)

    inspection_date: Mapped[date] = mapped_column(Date)
    inspector: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reported_progress: Mapped[float] = mapped_column()  # 0-100

    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)

    evidence_reference: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("evidence.id"), nullable=True
    )

    project: Mapped["Project"] = relationship(back_populates="inspections")
