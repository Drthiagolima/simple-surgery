import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class PatientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    birth_date: date | None
    medical_record_number: str | None
    created_at: datetime
