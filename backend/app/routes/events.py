from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.event import EventCreate, EventResponse
from app.services.auth_service import get_current_user
from app.services.event_service import create_operational_event

router = APIRouter(tags=["events"])


@router.post("/events", response_model=EventResponse, status_code=201)
def create_event(payload: EventCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return create_operational_event(db, payload)
