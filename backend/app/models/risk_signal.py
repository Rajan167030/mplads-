import uuid

from sqlalchemy import JSON, Enum, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin
from app.models.enums import Severity, SignalSource, SignalType


class RiskSignal(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "risk_signals"

    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), index=True)

    signal_type: Mapped[SignalType] = mapped_column(Enum(SignalType, native_enum=False, length=64))
    source: Mapped[SignalSource] = mapped_column(Enum(SignalSource, native_enum=False, length=16))
    severity: Mapped[Severity] = mapped_column(Enum(Severity, native_enum=False, length=16))

    score: Mapped[float] = mapped_column(Float)  # 0-100 contribution to risk engine
    confidence: Mapped[float] = mapped_column(Float, default=1.0)  # 0-1

    description: Mapped[str] = mapped_column(Text)

    # Structured evidence backing the signal (e.g. peer median, gap size, related
    # project ids) — what the explainability layer renders under each signal.
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)

    project: Mapped["Project"] = relationship(back_populates="risk_signals")
