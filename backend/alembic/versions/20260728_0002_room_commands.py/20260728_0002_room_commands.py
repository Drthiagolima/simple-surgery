"""add room commands table

Revision ID: 20260728_0002
Revises: 20260609_0001
Create Date: 2026-07-28 00:00:00
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260728_0002"
down_revision = "20260609_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "room_commands",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("target_department", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("room_number", sa.String(length=16), nullable=False),
        sa.Column("attendance_number", sa.String(length=32), nullable=False),
        sa.Column("surgeon_name", sa.String(length=255), nullable=False),
        sa.Column("anesthetist_name", sa.String(length=255), nullable=False),
        sa.Column("instrument_nurse_name", sa.String(length=255), nullable=False),
        sa.Column("surgery_type", sa.String(length=255), nullable=False),
        sa.Column("pharmacy_items", sa.JSON(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("acknowledged_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index("ix_room_commands_target_department", "room_commands", ["target_department"], unique=False)
    op.create_index("ix_room_commands_status", "room_commands", ["status"], unique=False)
    op.create_index("ix_room_commands_requested_at", "room_commands", ["requested_at"], unique=False)
    op.create_index("ix_room_commands_room_number", "room_commands", ["room_number"], unique=False)
    op.create_index("ix_room_commands_attendance_number", "room_commands", ["attendance_number"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_room_commands_attendance_number", table_name="room_commands")
    op.drop_index("ix_room_commands_room_number", table_name="room_commands")
    op.drop_index("ix_room_commands_requested_at", table_name="room_commands")
    op.drop_index("ix_room_commands_status", table_name="room_commands")
    op.drop_index("ix_room_commands_target_department", table_name="room_commands")
    op.drop_table("room_commands")
