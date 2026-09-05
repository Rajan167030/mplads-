import uuid

from sqlalchemy import JSON, Enum, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin
from app.models.enums import MatchVerdict


class EntityMatch(UUIDPKMixin, TimestampMixin, Base):
    """Result of multilingual entity resolution between two project records
    (see app.nlp entity resolution pipeline, Phase 3)."""

    __tablename__ = "entity_matches"

    source_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), index=True)
    matched_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), index=True)

    match_confidence: Mapped[float] = mapped_column(Float)  # 0-1
    verdict: Mapped[MatchVerdict] = mapped_column(Enum(MatchVerdict, native_enum=False, length=16))

    # Per-feature similarity scores: text, location, type, contractor, date, amount.
    matching_features: Mapped[dict] = mapped_column(JSON, default=dict)
