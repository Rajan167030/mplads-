from sqlalchemy import JSON, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin


class IngestionReport(UUIDPKMixin, TimestampMixin, Base):
    """One row per ingestion run — backs the data-quality dashboard (spec §6, §23).
    Every count here is computed by app.ingestion at run time; nothing is hard-coded."""

    __tablename__ = "ingestion_reports"

    source_filename: Mapped[str] = mapped_column(String(255))

    records_received: Mapped[int] = mapped_column(Integer)
    valid: Mapped[int] = mapped_column(Integer)
    invalid: Mapped[int] = mapped_column(Integer)

    missing_location: Mapped[int] = mapped_column(Integer, default=0)
    missing_contractor: Mapped[int] = mapped_column(Integer, default=0)
    missing_amount: Mapped[int] = mapped_column(Integer, default=0)

    duplicate_candidates: Mapped[int] = mapped_column(Integer, default=0)
    entity_matches: Mapped[int] = mapped_column(Integer, default=0)
    uncertain_matches: Mapped[int] = mapped_column(Integer, default=0)

    language_distribution: Mapped[dict] = mapped_column(JSON, default=dict)
    validation_errors: Mapped[list] = mapped_column(JSON, default=list)
