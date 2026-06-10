from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.operating_room import OperatingRoom
from app.models.user import User
from app.schemas.operating_room import OperatingRoomResponse
from app.services.auth_service import get_current_user

router = APIRouter(tags=["operating_rooms"])


@router.get("/operating-rooms", response_model=list[OperatingRoomResponse])
def list_operating_rooms(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = select(OperatingRoom).order_by(OperatingRoom.name.asc())
    return list(db.execute(query).scalars().all())
