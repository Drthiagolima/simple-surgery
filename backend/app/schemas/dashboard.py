from pydantic import BaseModel


class DashboardOverviewResponse(BaseModel):
    total_surgeries: int
    surgeries_in_progress: int
    surgeries_completed: int
    avg_rpa_minutes: float
    avg_room_minutes: float


class RoomSnapshot(BaseModel):
    room_id: str
    room_name: str
    status: str
    active_surgery_id: str | None = None
    occupancy_minutes_today: float
    idle_minutes_today: float


class DashboardRoomsResponse(BaseModel):
    rooms: list[RoomSnapshot]
