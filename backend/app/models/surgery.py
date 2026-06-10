import uuid

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import SurgeryStatus


class Surgery(Base):
    __tablename__ = "surgeries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), index=True)
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("operating_rooms.id"), index=True)
    surgeon_name: Mapped[str] = mapped_column(String(255))
    procedure_name: Mapped[str] = mapped_column(String(255))
    scheduled_start: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[SurgeryStatus] = mapped_column(Enum(SurgeryStatus), default=SurgeryStatus.scheduled)

    rpa_entry_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rpa_exit_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    room_entry_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    room_exit_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cc_exit_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    rpa_duration_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    room_duration_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_operational_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    patient = relationship("Patient")
    room = relationship("OperatingRoom")
    events = relationship("OperationalEvent", back_populates="surgery", cascade="all, delete-orphan")
