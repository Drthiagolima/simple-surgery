import uuid
from datetime import datetime, timedelta, timezone

from app.database.session import SessionLocal
from app.models.enums import EventType
from app.models.operating_room import OperatingRoom
from app.models.surgery import Surgery
from app.models.patient import Patient
from app.models.user import User
from app.schemas.event import EventCreate
from app.services.event_service import create_operational_event
from app.services.auth_service import hash_password


def _ensure_admin(db) -> User:
    admin = db.query(User).filter(User.email == "admin@simplesurgery.com.br").first()
    if admin:
        return admin

    admin = User(
        id=uuid.uuid4(),
        email="admin@simplesurgery.com.br",
        full_name="Administrador SIMPLE SURGERY",
        password_hash=hash_password("Admin@123"),
        role="admin",
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


def _ensure_centrocirurgico_user(db) -> User:
    user = db.query(User).filter(User.email == "centrocirurgico@simplesurgery.com.br").first()
    if user:
        return user

    user = User(
        id=uuid.uuid4(),
        email="centrocirurgico@simplesurgery.com.br",
        full_name="Centro Cirurgico SIMPLE SURGERY",
        password_hash=hash_password("simplesurgery"),
        role="operator",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _ensure_rooms(db) -> list[OperatingRoom]:
    rooms = list(db.query(OperatingRoom).order_by(OperatingRoom.name.asc()).all())
    if rooms:
        return rooms

    db.add_all(
        [
            OperatingRoom(name="Sala 01", status="available"),
            OperatingRoom(name="Sala 02", status="available"),
            OperatingRoom(name="Sala 03", status="available"),
        ]
    )
    db.commit()
    return list(db.query(OperatingRoom).order_by(OperatingRoom.name.asc()).all())


def _ensure_patients(db) -> list[Patient]:
    patients = list(db.query(Patient).order_by(Patient.medical_record_number.asc()).all())
    if patients:
        return patients

    db.add_all(
        [
            Patient(full_name="Mariana Costa", medical_record_number="SS-0001"),
            Patient(full_name="Rafael Moura", medical_record_number="SS-0002"),
            Patient(full_name="Claudia Nogueira", medical_record_number="SS-0003"),
        ]
    )
    db.commit()
    return list(db.query(Patient).order_by(Patient.medical_record_number.asc()).all())


def _create_surgery(
    db,
    *,
    patient_id,
    room_id,
    surgeon_name: str,
    procedure_name: str,
    scheduled_start: datetime,
) -> Surgery:
    surgery = Surgery(
        patient_id=patient_id,
        room_id=room_id,
        surgeon_name=surgeon_name,
        procedure_name=procedure_name,
        scheduled_start=scheduled_start,
    )
    db.add(surgery)
    db.commit()
    db.refresh(surgery)
    return surgery


def _register_event(db, *, surgery_id, event_type: EventType, occurred_at: datetime, created_by, payload=None) -> None:
    create_operational_event(
        db,
        EventCreate(
            surgery_id=surgery_id,
            event_type=event_type.value,
            occurred_at=occurred_at,
            created_by=created_by,
            payload=payload or {"source": "seed"},
        ),
    )


def _seed_demo_surgeries(db, admin: User, rooms: list[OperatingRoom], patients: list[Patient]) -> None:
    if db.query(Surgery).count() > 0:
        return

    now = datetime.now(timezone.utc)

    completed = _create_surgery(
        db,
        patient_id=patients[0].id,
        room_id=rooms[0].id,
        surgeon_name="Dr. Helena Bastos",
        procedure_name="Artroscopia de joelho",
        scheduled_start=now - timedelta(hours=5),
    )
    _register_event(db, surgery_id=completed.id, event_type=EventType.rpa_entry, occurred_at=now - timedelta(hours=4, minutes=40), created_by=admin.id)
    _register_event(db, surgery_id=completed.id, event_type=EventType.rpa_exit, occurred_at=now - timedelta(hours=4, minutes=5), created_by=admin.id)
    _register_event(db, surgery_id=completed.id, event_type=EventType.room_entry, occurred_at=now - timedelta(hours=4), created_by=admin.id)
    _register_event(db, surgery_id=completed.id, event_type=EventType.room_exit, occurred_at=now - timedelta(hours=2, minutes=35), created_by=admin.id)
    _register_event(db, surgery_id=completed.id, event_type=EventType.cc_exit, occurred_at=now - timedelta(hours=2, minutes=15), created_by=admin.id)

    in_room = _create_surgery(
        db,
        patient_id=patients[1].id,
        room_id=rooms[1].id,
        surgeon_name="Dr. Renato Figueiredo",
        procedure_name="Artroplastia total de quadril",
        scheduled_start=now - timedelta(hours=2, minutes=30),
    )
    _register_event(db, surgery_id=in_room.id, event_type=EventType.rpa_entry, occurred_at=now - timedelta(hours=2, minutes=10), created_by=admin.id)
    _register_event(db, surgery_id=in_room.id, event_type=EventType.rpa_exit, occurred_at=now - timedelta(hours=1, minutes=35), created_by=admin.id)
    _register_event(db, surgery_id=in_room.id, event_type=EventType.room_entry, occurred_at=now - timedelta(hours=1, minutes=20), created_by=admin.id)

    _create_surgery(
        db,
        patient_id=patients[2].id,
        room_id=rooms[2].id,
        surgeon_name="Dra. Camila Duarte",
        procedure_name="Reconstrucao ligamentar",
        scheduled_start=now + timedelta(minutes=45),
    )


def seed() -> None:
    db = SessionLocal()
    try:
        admin = _ensure_admin(db)
        _ensure_centrocirurgico_user(db)
        rooms = _ensure_rooms(db)
        patients = _ensure_patients(db)
        _seed_demo_surgeries(db, admin, rooms, patients)

        print("Seed concluido com sucesso.")
        print("Usuario: admin@simplesurgery.com.br | Senha: Admin@123")
        print("Usuario: centrocirurgico@simplesurgery.com.br | Senha: simplesurgery")
        print("Dados demo: 3 salas, 3 pacientes e 3 cirurgias de exemplo.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
