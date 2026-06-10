"""initial schema

Revision ID: 20260609_0001
Revises:
Create Date: 2026-06-09 00:00:00
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260609_0001"
down_revision = None
branch_labels = None
depends_on = None


surgery_status_enum = sa.Enum(
    "scheduled",
    "in_rpa",
    "ready_for_room",
    "in_room",
    "room_released",
    "completed",
    name="surgerystatus",
)

event_type_enum = sa.Enum(
    "rpa_entry",
    "rpa_exit",
    "room_entry",
    "room_exit",
    "cc_exit",
    name="eventtype",
)


def upgrade() -> None:
    surgery_status_enum.create(op.get_bind(), checkfirst=True)
    event_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=80), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "patients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("medical_record_number", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_patients_full_name", "patients", ["full_name"], unique=False)
    op.create_index("ix_patients_medical_record_number", "patients", ["medical_record_number"], unique=True)

    op.create_table(
        "operating_rooms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_operating_rooms_name", "operating_rooms", ["name"], unique=True)

    op.create_table(
        "surgeries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("operating_rooms.id"), nullable=False),
        sa.Column("surgeon_name", sa.String(length=255), nullable=False),
        sa.Column("procedure_name", sa.String(length=255), nullable=False),
        sa.Column("scheduled_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", surgery_status_enum, nullable=False),
        sa.Column("rpa_entry_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rpa_exit_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("room_entry_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("room_exit_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cc_exit_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rpa_duration_minutes", sa.Float(), nullable=True),
        sa.Column("room_duration_minutes", sa.Float(), nullable=True),
        sa.Column("total_operational_minutes", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_surgeries_patient_id", "surgeries", ["patient_id"], unique=False)
    op.create_index("ix_surgeries_room_id", "surgeries", ["room_id"], unique=False)

    op.create_table(
        "operational_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("surgery_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("surgeries.id"), nullable=False),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("operating_rooms.id"), nullable=True),
        sa.Column("event_type", event_type_enum, nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
    )
    op.create_index("ix_operational_events_surgery_id", "operational_events", ["surgery_id"], unique=False)
    op.create_index("ix_operational_events_event_type", "operational_events", ["event_type"], unique=False)
    op.create_index("ix_operational_events_occurred_at", "operational_events", ["occurred_at"], unique=False)

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("surgery_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("surgeries.id"), nullable=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id"), nullable=True),
        sa.Column("document_type", sa.String(length=100), nullable=False),
        sa.Column("storage_url", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("entity_type", sa.String(length=120), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"], unique=False)
    op.create_index("ix_audit_logs_entity_type", "audit_logs", ["entity_type"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_logs_entity_type", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_table("documents")

    op.drop_index("ix_operational_events_occurred_at", table_name="operational_events")
    op.drop_index("ix_operational_events_event_type", table_name="operational_events")
    op.drop_index("ix_operational_events_surgery_id", table_name="operational_events")
    op.drop_table("operational_events")

    op.drop_index("ix_surgeries_room_id", table_name="surgeries")
    op.drop_index("ix_surgeries_patient_id", table_name="surgeries")
    op.drop_table("surgeries")

    op.drop_index("ix_operating_rooms_name", table_name="operating_rooms")
    op.drop_table("operating_rooms")

    op.drop_index("ix_patients_medical_record_number", table_name="patients")
    op.drop_index("ix_patients_full_name", table_name="patients")
    op.drop_table("patients")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    event_type_enum.drop(op.get_bind(), checkfirst=True)
    surgery_status_enum.drop(op.get_bind(), checkfirst=True)
