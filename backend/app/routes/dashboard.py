from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardOverviewResponse, DashboardRoomsResponse
from app.services.auth_service import get_current_user
from app.services.dashboard_service import get_overview, get_room_snapshots

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/overview", response_model=DashboardOverviewResponse)
def dashboard_overview(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return get_overview(db)


@router.get("/dashboard/rooms", response_model=DashboardRoomsResponse)
def dashboard_rooms(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return DashboardRoomsResponse(rooms=get_room_snapshots(db))
