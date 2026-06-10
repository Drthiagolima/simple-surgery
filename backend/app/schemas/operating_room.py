import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class OperatingRoomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    status: str
    created_at: datetime
