from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.operating_room import OperatingRoom
from app.models.enums import SurgeryStatus
from app.models.surgery import Surgery


def _today_start_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return datetime(year=now.year, month=now.month, day=now.day, tzinfo=timezone.utc)


def get_overview(db: Session) -> dict:
    total = db.execute(select(func.count(Surgery.id))).scalar_one()
    in_progress = db.execute(
        select(func.count(Surgery.id)).where(
            Surgery.status.in_([SurgeryStatus.in_rpa, SurgeryStatus.ready_for_room, SurgeryStatus.in_room])
        )
    ).scalar_one()
    completed = db.execute(select(func.count(Surgery.id)).where(Surgery.status == SurgeryStatus.completed)).scalar_one()

    avg_rpa = db.execute(select(func.avg(Surgery.rpa_duration_minutes))).scalar_one()
    avg_room = db.execute(select(func.avg(Surgery.room_duration_minutes))).scalar_one()

    return {
        "total_surgeries": int(total or 0),
        "surgeries_in_progress": int(in_progress or 0),
        "surgeries_completed": int(completed or 0),
        "avg_rpa_minutes": round(float(avg_rpa or 0), 2),
        "avg_room_minutes": round(float(avg_room or 0), 2),
    }


def get_room_snapshots(db: Session) -> list[dict]:
    day_start = _today_start_utc()
    rooms = list(db.execute(select(OperatingRoom)).scalars().all())
    snapshots: list[dict] = []

    for room in rooms:
        surgeries = list(
            db.execute(
                select(Surgery)
                .where(Surgery.room_id == room.id, Surgery.created_at >= day_start)
                .order_by(Surgery.room_entry_at.asc())
            ).scalars()
        )

        occupancy_minutes = 0.0
        idle_minutes = 0.0
        previous_exit = None
        active_surgery_id = None

        for surgery in surgeries:
            if surgery.room_duration_minutes:
                occupancy_minutes += surgery.room_duration_minutes

            if surgery.status in (SurgeryStatus.in_room, SurgeryStatus.ready_for_room, SurgeryStatus.in_rpa):
                active_surgery_id = str(surgery.id)

            if previous_exit and surgery.room_entry_at and surgery.room_entry_at > previous_exit:
                idle_minutes += (surgery.room_entry_at - previous_exit).total_seconds() / 60.0

            if surgery.room_exit_at:
                previous_exit = surgery.room_exit_at

        snapshots.append(
            {
                "room_id": str(room.id),
                "room_name": room.name,
                "status": room.status,
                "active_surgery_id": active_surgery_id,
                "occupancy_minutes_today": round(occupancy_minutes, 2),
                "idle_minutes_today": round(idle_minutes, 2),
            }
        )

    return snapshots
