from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.room_command import RoomCommand
from app.models.user import User
from app.schemas.room_command import RoomCommandCreate

ALLOWED_TARGETS = {"cme", "farmacia"}
ALLOWED_STATUSES = {"pending", "acknowledged"}


def _normalize_target(target_department: str) -> str:
    normalized = target_department.strip().lower()
    if normalized not in ALLOWED_TARGETS:
        raise HTTPException(status_code=400, detail="Target department must be cme or farmacia")
    return normalized


def _resolve_user_target_scope(user: User) -> str | None:
    email = (user.email or "").strip().lower()
    role = (user.role or "").strip().lower()

    if email == "cme@simplesurgery.com.br" or role == "cme":
        return "cme"
    if email == "farmacia@simplesurgery.com.br" or role == "farmacia":
        return "farmacia"
    return None


def create_room_command(db: Session, payload: RoomCommandCreate, *, current_user: User) -> RoomCommand:
    target_department = _normalize_target(payload.target_department)
    pharmacy_items = payload.pharmacy_items or []

    if target_department == "farmacia" and len(pharmacy_items) == 0:
        raise HTTPException(status_code=400, detail="Pharmacy command requires at least one item")

    command = RoomCommand(
        target_department=target_department,
        status="pending",
        requested_at=datetime.now(timezone.utc),
        room_number=payload.room_number.strip(),
        attendance_number=payload.attendance_number.strip(),
        surgeon_name=payload.surgeon_name.strip(),
        anesthetist_name=payload.anesthetist_name.strip(),
        instrument_nurse_name=payload.instrument_nurse_name.strip(),
        surgery_type=payload.surgery_type.strip(),
        pharmacy_items=pharmacy_items if target_department == "farmacia" else None,
        created_by=current_user.id,
    )

    db.add(command)
    db.commit()
    db.refresh(command)
    return command


def list_room_commands(
    db: Session,
    *,
    current_user: User,
    target_department: str | None,
    status: str | None,
    limit: int,
) -> list[RoomCommand]:
    query = select(RoomCommand)

    scoped_target = _resolve_user_target_scope(current_user)
    normalized_target = _normalize_target(target_department) if target_department else None

    if scoped_target:
        query = query.where(RoomCommand.target_department == scoped_target)
    elif normalized_target:
        query = query.where(RoomCommand.target_department == normalized_target)

    if status:
        normalized_status = status.strip().lower()
        if normalized_status not in ALLOWED_STATUSES and normalized_status != "all":
            raise HTTPException(status_code=400, detail="Status must be pending, acknowledged, or all")
        if normalized_status != "all":
            query = query.where(RoomCommand.status == normalized_status)

    query = query.order_by(desc(RoomCommand.requested_at)).limit(limit)
    return list(db.execute(query).scalars().all())


def acknowledge_room_command(db: Session, command_id, *, current_user: User) -> RoomCommand:
    command = db.get(RoomCommand, command_id)
    if not command:
        raise HTTPException(status_code=404, detail="Room command not found")

    scoped_target = _resolve_user_target_scope(current_user)
    if scoped_target and command.target_department != scoped_target:
        raise HTTPException(status_code=403, detail="User cannot acknowledge this command")

    if command.status != "pending":
        return command

    command.status = "acknowledged"
    command.acknowledged_at = datetime.now(timezone.utc)
    command.acknowledged_by = current_user.id

    db.commit()
    db.refresh(command)
    return command
