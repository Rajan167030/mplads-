import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin


class AssistantConversation(UUIDPKMixin, TimestampMixin, Base):
    """One chat thread. Optionally carries one uploaded document's extracted
    text — kept directly on the conversation (not a separate table/store)
    since the scope here is "one reference document per conversation", not a
    general document library."""

    __tablename__ = "assistant_conversations"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255), default="New conversation")
    project_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)

    document_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    document_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    messages: Mapped[list["AssistantMessage"]] = relationship(
        back_populates="conversation", order_by="AssistantMessage.created_at", cascade="all, delete-orphan"
    )
