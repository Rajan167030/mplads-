from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin


class Contractor(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "contractors"

    external_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    normalized_name: Mapped[str] = mapped_column(String(255), index=True)

    state: Mapped[str | None] = mapped_column(String(128), nullable=True)
    district: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Aggregate stats — computed by app.services.contractor_intelligence after
    # ingestion / pattern detection, not authored by hand. Default to zero/null
    # until that pass has run.
    total_projects: Mapped[int] = mapped_column(Integer, default=0)
    completed_projects: Mapped[int] = mapped_column(Integer, default=0)
    delayed_projects: Mapped[int] = mapped_column(Integer, default=0)
    high_risk_projects: Mapped[int] = mapped_column(Integer, default=0)

    average_cost_overrun: Mapped[float | None] = mapped_column(Float, nullable=True)
    average_delay_days: Mapped[float | None] = mapped_column(Float, nullable=True)

    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    projects: Mapped[list["Project"]] = relationship(back_populates="contractor")
