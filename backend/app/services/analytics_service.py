from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.operating_room import OperatingRoom
from app.models.surgery import Surgery


def get_idle_time(db: Session, room_id: str | None = None, period_days: int | None = None) -> dict:
    rooms = list(db.execute(select(OperatingRoom)).scalars().all())

    if room_id:
        rooms = [room for room in rooms if str(room.id) == room_id]

    since = None
    if period_days is not None:
        since = datetime.now(timezone.utc) - timedelta(days=period_days)

    results: list[dict] = []
    total_idle = 0.0

    for room in rooms:
        surgeries = list(
            db.execute(
                select(Surgery)
                .where(Surgery.room_id == room.id)
                .order_by(Surgery.room_entry_at.asc())
            ).scalars()
        )

        if since is not None:
            surgeries = [
                surgery
                for surgery in surgeries
                if (surgery.room_entry_at and surgery.room_entry_at >= since)
                or (surgery.room_exit_at and surgery.room_exit_at >= since)
            ]

        idle_minutes = 0.0
        previous_exit = None

        for surgery in surgeries:
            if previous_exit and surgery.room_entry_at and surgery.room_entry_at > previous_exit:
                idle_minutes += (surgery.room_entry_at - previous_exit).total_seconds() / 60.0
            if surgery.room_exit_at:
                previous_exit = surgery.room_exit_at

        total_idle += idle_minutes
        results.append(
            {
                "room_id": str(room.id),
                "room_name": room.name,
                "idle_minutes": round(idle_minutes, 2),
            }
        )

    return {"total_idle_minutes": round(total_idle, 2), "rooms": results}
