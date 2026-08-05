import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.room_command import RoomCommandCreate, RoomCommandResponse
from app.services.auth_service import get_current_user
from app.services.room_command_service import acknowledge_room_command, create_room_command, list_room_commands

router = APIRouter(tags=["room-commands"])


@router.post("/room-commands", response_model=RoomCommandResponse, status_code=201)
def create_command(
    payload: RoomCommandCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_room_command(db, payload, current_user=current_user)


@router.get("/room-commands", response_model=list[RoomCommandResponse])
def list_commands(
    target_department: str | None = Query(default=None),
    status: str | None = Query(default="pending"),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_room_commands(
        db,
        current_user=current_user,
        target_department=target_department,
        status=status,
        limit=limit,
    )


@router.post("/room-commands/{command_id}/acknowledge", response_model=RoomCommandResponse)
def acknowledge_command(
    command_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return acknowledge_room_command(db, command_id, current_user=current_user)
