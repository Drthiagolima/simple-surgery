from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.patient import Patient
from app.models.user import User
from app.schemas.patient import PatientResponse
from app.services.auth_service import get_current_user

router = APIRouter(tags=["patients"])


@router.get("/patients", response_model=list[PatientResponse])
def list_patients(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = select(Patient).order_by(Patient.full_name.asc())
    return list(db.execute(query).scalars().all())
