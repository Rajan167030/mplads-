import uuid

from sqlalchemy import Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin
from app.models.enums import InvestigationResolution, InvestigationStatus, Severity


class Investigation(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "investigations"

    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), index=True)

    priority: Mapped[Severity] = mapped_column(Enum(Severity, native_enum=False, length=16))
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    status: Mapped[InvestigationStatus] = mapped_column(
        Enum(InvestigationStatus, native_enum=False, length=16), default=InvestigationStatus.OPEN
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution: Mapped[InvestigationResolution | None] = mapped_column(
        Enum(InvestigationResolution, native_enum=False, length=32), nullable=True
    )

    project: Mapped["Project"] = relationship()
    assignee: Mapped["User | None"] = relationship(foreign_keys=[assigned_to])
