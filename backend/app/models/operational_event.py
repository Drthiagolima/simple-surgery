import uuid

from sqlalchemy import DateTime, Enum, ForeignKey, JSON, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import EventType


class OperationalEvent(Base):
    __tablename__ = "operational_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    surgery_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("surgeries.id"), index=True)
    room_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("operating_rooms.id"), nullable=True)
    event_type: Mapped[EventType] = mapped_column(Enum(EventType), index=True)
    occurred_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    surgery = relationship("Surgery", back_populates="events")
