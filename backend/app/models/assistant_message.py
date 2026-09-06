import uuid

from sqlalchemy import JSON, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin
from app.models.enums import MessageRole


class AssistantMessage(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "assistant_messages"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assistant_conversations.id"), index=True
    )
    role: Mapped[MessageRole] = mapped_column(Enum(MessageRole, native_enum=False, length=16))
    content: Mapped[str] = mapped_column(Text)
    grounded_on: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    conversation: Mapped["AssistantConversation"] = relationship(back_populates="messages")
