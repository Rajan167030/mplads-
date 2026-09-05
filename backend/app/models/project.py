import uuid
from datetime import date

from geoalchemy2 import Geometry
from pgvector.sqlalchemy import Vector
from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin
from app.models.enums import ProjectStatus, ProjectType, Severity

# all-MiniLM-L6-v2 (used for multilingual-adjacent sentence embeddings in Phase 3)
EMBEDDING_DIM = 384


class Project(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "projects"

    external_project_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    project_name: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String(8), nullable=True)  # ISO 639-1, set by language detection

    project_type: Mapped[ProjectType] = mapped_column(Enum(ProjectType, native_enum=False, length=32))
    sub_type: Mapped[str | None] = mapped_column(String(128), nullable=True)

    state: Mapped[str] = mapped_column(String(128), index=True)
    district: Mapped[str] = mapped_column(String(128), index=True)
    constituency: Mapped[str | None] = mapped_column(String(128), nullable=True)

    latitude: Mapped[float | None] = mapped_column(nullable=True)
    longitude: Mapped[float | None] = mapped_column(nullable=True)
    geom: Mapped[str | None] = mapped_column(Geometry(geometry_type="POINT", srid=4326), nullable=True)

    sanctioned_amount: Mapped[float] = mapped_column(Numeric(14, 2))
    estimated_cost: Mapped[float] = mapped_column(Numeric(14, 2))
    released_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    expenditure_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)

    start_date: Mapped[date] = mapped_column(Date)
    expected_completion_date: Mapped[date] = mapped_column(Date)
    actual_completion_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    physical_progress: Mapped[float] = mapped_column(default=0)  # 0-100
    financial_progress: Mapped[float] = mapped_column(default=0)  # 0-100

    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus, native_enum=False, length=32))

    contractor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contractors.id"), nullable=True
    )
    implementing_agency_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agencies.id"), nullable=True
    )

    # Populated in Phase 3 (multilingual entity resolution / semantic similarity).
    name_embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)

    # Populated in Phase 6 (risk engine) by combining every RiskSignal for this
    # project — never hand-set. See app.risk.scoring for the aggregation formula.
    risk_score: Mapped[float | None] = mapped_column(nullable=True)  # 0-100
    risk_band: Mapped[Severity | None] = mapped_column(Enum(Severity, native_enum=False, length=16), nullable=True)

    contractor: Mapped["Contractor | None"] = relationship(back_populates="projects")
    implementing_agency: Mapped["Agency | None"] = relationship()
    payments: Mapped[list["Payment"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    milestones: Mapped[list["Milestone"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    inspections: Mapped[list["Inspection"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    evidence: Mapped[list["Evidence"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    risk_signals: Mapped[list["RiskSignal"]] = relationship(back_populates="project", cascade="all, delete-orphan")
