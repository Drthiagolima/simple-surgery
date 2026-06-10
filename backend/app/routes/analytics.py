from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.analytics import IdleTimeResponse
from app.services.auth_service import get_current_user
from app.services.analytics_service import get_idle_time

router = APIRouter(tags=["analytics"])


@router.get("/analytics/idle-time", response_model=IdleTimeResponse)
def analytics_idle_time(
    room_id: str | None = Query(default=None),
    period_days: int | None = Query(default=None, ge=1, le=365),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return get_idle_time(db, room_id=room_id, period_days=period_days)
