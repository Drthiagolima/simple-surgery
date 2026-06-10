import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.surgery import (
    SurgeryCreate,
    SurgeryResponse,
    SurgeryTimelineItem,
    SurgeryTimelineResponse,
)
from app.services.auth_service import get_current_user
from app.services.surgery_service import (
    create_surgery,
    get_surgery_by_id,
    get_surgery_timeline,
    list_surgeries,
)

router = APIRouter(tags=["surgeries"])


@router.get("/surgeries", response_model=list[SurgeryResponse])
def list_all_surgeries(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return list_surgeries(db)


@router.post("/surgeries", response_model=SurgeryResponse, status_code=201)
def create_new_surgery(
    payload: SurgeryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return create_surgery(db, payload)


@router.get("/surgeries/{surgery_id}/timeline", response_model=SurgeryTimelineResponse)
def get_timeline(surgery_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    surgery = get_surgery_by_id(db, surgery_id)
    if not surgery:
        raise HTTPException(status_code=404, detail="Surgery not found")

    timeline = [
        SurgeryTimelineItem(event_type=item.event_type.value, occurred_at=item.occurred_at, payload=item.payload)
        for item in get_surgery_timeline(db, surgery_id)
    ]
    return SurgeryTimelineResponse(surgery=surgery, timeline=timeline)
