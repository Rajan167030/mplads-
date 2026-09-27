import uuid

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin
from app.models.enums import ReviewVerdict


class InvestigationReview(UUIDPKMixin, TimestampMixin, Base):
    """
    A review entry on an investigation — officers at each tier can add their
    findings, verdict, and commentary. Multiple reviews can exist per
    investigation (one per reviewer / review round).
    """
    __tablename__ = "investigation_reviews"

    investigation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("investigations.id"), index=True
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )

    verdict: Mapped[ReviewVerdict] = mapped_column(
        Enum(ReviewVerdict, native_enum=False, length=32)
    )
    findings: Mapped[str] = mapped_column(Text)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_references: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Comma-separated evidence IDs or file references"
    )

    investigation: Mapped["Investigation"] = relationship(back_populates="reviews")
    reviewer: Mapped["User"] = relationship()
