import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin
from app.models.enums import PaymentStatus, PaymentType


class Payment(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "payments"

    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), index=True)

    amount: Mapped[float] = mapped_column(Numeric(14, 2))
    payment_date: Mapped[date] = mapped_column(Date)

    payment_type: Mapped[PaymentType] = mapped_column(Enum(PaymentType, native_enum=False, length=32))
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, native_enum=False, length=32), default=PaymentStatus.CLEARED
    )

    recipient: Mapped[str | None] = mapped_column(String(255), nullable=True)
    transaction_reference: Mapped[str | None] = mapped_column(String(128), nullable=True)

    project: Mapped["Project"] = relationship(back_populates="payments")
