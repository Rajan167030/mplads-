import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin
from app.models.enums import MilestoneStatus


class Milestone(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "milestones"

    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), index=True)

    name: Mapped[str] = mapped_column(String(255))
    expected_date: Mapped[date] = mapped_column(Date)
    actual_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    expected_progress: Mapped[float] = mapped_column()  # 0-100
    actual_progress: Mapped[float | None] = mapped_column(nullable=True)  # 0-100

    status: Mapped[MilestoneStatus] = mapped_column(
        Enum(MilestoneStatus, native_enum=False, length=32), default=MilestoneStatus.PENDING
    )

    project: Mapped["Project"] = relationship(back_populates="milestones")
