import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RoomCommandCreate(BaseModel):
    target_department: str = Field(pattern="^(cme|farmacia)$")
    room_number: str = Field(min_length=1, max_length=16)
    attendance_number: str = Field(min_length=3, max_length=32)
    surgeon_name: str = Field(min_length=2, max_length=255)
    anesthetist_name: str = Field(min_length=2, max_length=255)
    instrument_nurse_name: str = Field(min_length=2, max_length=255)
    surgery_type: str = Field(min_length=2, max_length=255)
    pharmacy_items: list[str] | None = None


class RoomCommandResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    target_department: str
    status: str
    requested_at: datetime
    acknowledged_at: datetime | None
    room_number: str
    attendance_number: str
    surgeon_name: str
    anesthetist_name: str
    instrument_nurse_name: str
    surgery_type: str
    pharmacy_items: list[str] | None
    created_by: uuid.UUID | None
    acknowledged_by: uuid.UUID | None
    created_at: datetime
