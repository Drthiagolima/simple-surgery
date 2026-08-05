import uuid

from sqlalchemy import DateTime, ForeignKey, JSON, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class RoomCommand(Base):
    __tablename__ = "room_commands"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    target_department: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)

    requested_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    acknowledged_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    room_number: Mapped[str] = mapped_column(String(16), index=True)
    attendance_number: Mapped[str] = mapped_column(String(32), index=True)
    surgeon_name: Mapped[str] = mapped_column(String(255))
    anesthetist_name: Mapped[str] = mapped_column(String(255))
    instrument_nurse_name: Mapped[str] = mapped_column(String(255))
    surgery_type: Mapped[str] = mapped_column(String(255))

    pharmacy_items: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    acknowledged_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
