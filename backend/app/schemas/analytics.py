from pydantic import BaseModel


class IdleTimeItem(BaseModel):
    room_id: str
    room_name: str
    idle_minutes: float


class IdleTimeResponse(BaseModel):
    total_idle_minutes: float
    rooms: list[IdleTimeItem]
