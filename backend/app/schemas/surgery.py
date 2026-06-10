import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SurgeryCreate(BaseModel):
    patient_id: uuid.UUID
    room_id: uuid.UUID
    surgeon_name: str
    procedure_name: str
    scheduled_start: datetime | None = None


class SurgeryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    room_id: uuid.UUID
    surgeon_name: str
    procedure_name: str
    scheduled_start: datetime | None
    status: str
    rpa_entry_at: datetime | None
    rpa_exit_at: datetime | None
    room_entry_at: datetime | None
    room_exit_at: datetime | None
    cc_exit_at: datetime | None
    rpa_duration_minutes: float | None
    room_duration_minutes: float | None
    total_operational_minutes: float | None
    created_at: datetime
    updated_at: datetime


class SurgeryTimelineItem(BaseModel):
    event_type: str
    occurred_at: datetime
    payload: dict | None = None


class SurgeryTimelineResponse(BaseModel):
    surgery: SurgeryResponse
    timeline: list[SurgeryTimelineItem]
