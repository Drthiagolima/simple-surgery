import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EventCreate(BaseModel):
    surgery_id: uuid.UUID
    event_type: str
    occurred_at: datetime | None = None
    created_by: uuid.UUID | None = None
    payload: dict | None = None


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    surgery_id: uuid.UUID
    room_id: uuid.UUID | None
    event_type: str
    occurred_at: datetime
    created_by: uuid.UUID | None
    payload: dict | None
