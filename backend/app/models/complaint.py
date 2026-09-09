import uuid

from geoalchemy2 import Geometry
from sqlalchemy import Enum, Float, ForeignKey, LargeBinary, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin
from app.models.enums import ComplaintStatus


class Complaint(UUIDPKMixin, TimestampMixin, Base):
    """A citizen-submitted, anonymous complaint against a project. No column
    on this table identifies who submitted it — anonymous_token is a random
    receipt handed back to the submitter so they can check status later, not
    an identity. Location trust comes from the device's live GPS reading at
    submission time (submitted_latitude/longitude), checked against the
    project's own location — never from image EXIF, which is easily stripped
    or absent."""

    __tablename__ = "complaints"

    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), index=True)

    description: Mapped[str] = mapped_column(Text)

    photo_data: Mapped[bytes] = mapped_column(LargeBinary)
    photo_content_type: Mapped[str] = mapped_column(String(64))

    submitted_latitude: Mapped[float] = mapped_column(Float)
    submitted_longitude: Mapped[float] = mapped_column(Float)
    submitted_geom: Mapped[str] = mapped_column(Geometry(geometry_type="POINT", srid=4326))

    # Distance between submitted_geom and the project's own geom, in meters.
    # Null when the project has no stored location to compare against.
    distance_to_project_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_location_verified: Mapped[bool] = mapped_column(default=False)

    status: Mapped[ComplaintStatus] = mapped_column(
        Enum(ComplaintStatus, native_enum=False, length=16), default=ComplaintStatus.PENDING
    )
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    anonymous_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    project: Mapped["Project"] = relationship()
