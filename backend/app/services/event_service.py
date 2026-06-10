from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.enums import EventType, SurgeryStatus
from app.models.operating_room import OperatingRoom
from app.models.operational_event import OperationalEvent
from app.models.surgery import Surgery
from app.schemas.event import EventCreate

EVENT_TO_SURGERY_FIELD = {
    EventType.rpa_entry: "rpa_entry_at",
    EventType.rpa_exit: "rpa_exit_at",
    EventType.room_entry: "room_entry_at",
    EventType.room_exit: "room_exit_at",
    EventType.cc_exit: "cc_exit_at",
}

EVENT_TO_STATUS = {
    EventType.rpa_entry: SurgeryStatus.in_rpa,
    EventType.rpa_exit: SurgeryStatus.ready_for_room,
    EventType.room_entry: SurgeryStatus.in_room,
    EventType.room_exit: SurgeryStatus.room_released,
    EventType.cc_exit: SurgeryStatus.completed,
}

EVENT_PREREQUISITE_FIELD = {
    EventType.rpa_exit: "rpa_entry_at",
    EventType.room_entry: "rpa_exit_at",
    EventType.room_exit: "room_entry_at",
    EventType.cc_exit: "room_exit_at",
}


def _minutes_between(start: datetime | None, end: datetime | None) -> float | None:
    if not start or not end:
        return None
    delta = end - start
    return round(max(delta.total_seconds(), 0) / 60.0, 2)


def _update_surgery_metrics(surgery: Surgery) -> None:
    surgery.rpa_duration_minutes = _minutes_between(surgery.rpa_entry_at, surgery.rpa_exit_at)
    surgery.room_duration_minutes = _minutes_between(surgery.room_entry_at, surgery.room_exit_at)
    surgery.total_operational_minutes = _minutes_between(surgery.rpa_entry_at, surgery.cc_exit_at)


def create_operational_event(db: Session, payload: EventCreate) -> OperationalEvent:
    surgery = db.get(Surgery, payload.surgery_id)
    if not surgery:
        raise HTTPException(status_code=404, detail="Surgery not found")

    try:
        event_type = EventType(payload.event_type)
    except ValueError as exc:
        allowed = ", ".join([item.value for item in EventType])
        raise HTTPException(status_code=400, detail=f"Invalid event_type. Allowed: {allowed}") from exc

    event_time = payload.occurred_at or datetime.now(timezone.utc)

    target_field = EVENT_TO_SURGERY_FIELD[event_type]
    if getattr(surgery, target_field) is not None:
        raise HTTPException(status_code=409, detail=f"Event {event_type.value} already registered")

    prerequisite_field = EVENT_PREREQUISITE_FIELD.get(event_type)
    if prerequisite_field:
        prerequisite_time = getattr(surgery, prerequisite_field)
        if prerequisite_time is None:
            raise HTTPException(
                status_code=400,
                detail=f"Event {event_type.value} requires previous stage {prerequisite_field}",
            )
        if event_time < prerequisite_time:
            raise HTTPException(
                status_code=400,
                detail=f"Event {event_type.value} occurred before {prerequisite_field}",
            )

    event = OperationalEvent(
        surgery_id=surgery.id,
        room_id=surgery.room_id,
        event_type=event_type,
        occurred_at=event_time,
        created_by=payload.created_by,
        payload=payload.payload,
    )
    db.add(event)

    setattr(surgery, target_field, event_time)
    surgery.status = EVENT_TO_STATUS[event_type]

    room = db.get(OperatingRoom, surgery.room_id)
    if room:
        if event_type == EventType.room_entry:
            room.status = "occupied"
        if event_type in (EventType.room_exit, EventType.cc_exit):
            room.status = "available"

    _update_surgery_metrics(surgery)

    db.commit()
    db.refresh(event)
    return event
