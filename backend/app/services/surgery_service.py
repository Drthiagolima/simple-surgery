import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.operational_event import OperationalEvent
from app.models.surgery import Surgery
from app.schemas.surgery import SurgeryCreate


def list_surgeries(db: Session) -> list[Surgery]:
    return list(db.execute(select(Surgery).order_by(Surgery.created_at.desc())).scalars().all())


def create_surgery(db: Session, payload: SurgeryCreate) -> Surgery:
    surgery = Surgery(
        patient_id=payload.patient_id,
        room_id=payload.room_id,
        surgeon_name=payload.surgeon_name,
        procedure_name=payload.procedure_name,
        scheduled_start=payload.scheduled_start,
    )
    db.add(surgery)
    db.commit()
    db.refresh(surgery)
    return surgery


def get_surgery_by_id(db: Session, surgery_id: uuid.UUID) -> Surgery | None:
    return db.execute(select(Surgery).where(Surgery.id == surgery_id)).scalar_one_or_none()


def get_surgery_timeline(db: Session, surgery_id: uuid.UUID) -> list[OperationalEvent]:
    query = (
        select(OperationalEvent)
        .where(OperationalEvent.surgery_id == surgery_id)
        .order_by(OperationalEvent.occurred_at.asc())
    )
    return list(db.execute(query).scalars().all())
