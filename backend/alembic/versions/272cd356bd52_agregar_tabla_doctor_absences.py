"""Agregar tabla doctor_absences

Revision ID: 272cd356bd52
Revises: e35c54805ea1
Create Date: 2026-10-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "272cd356bd52"
down_revision: Union[str, Sequence[str], None] = "e35c54805ea1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Crear tabla doctor_absences."""
    op.create_table(
        "doctor_absences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("absence_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notified_by", sa.Integer(), nullable=False),
        sa.Column("seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("seen_by", sa.Integer(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], name="fk_doctor_absences_doctor_id"),
        sa.ForeignKeyConstraint(["notified_by"], ["users.id"], name="fk_doctor_absences_notified_by"),
        sa.ForeignKeyConstraint(["seen_by"], ["users.id"], name="fk_doctor_absences_seen_by"),
        sa.ForeignKeyConstraint(["resolved_by"], ["users.id"], name="fk_doctor_absences_resolved_by"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_doctor_absences_doctor_id", "doctor_absences", ["doctor_id"])
    op.create_index("ix_doctor_absences_absence_date", "doctor_absences", ["absence_date"])

def downgrade() -> None:
    """Eliminar tabla doctor_absences."""
    op.drop_index("ix_doctor_absences_absence_date", table_name="doctor_absences")
    op.drop_index("ix_doctor_absences_doctor_id", table_name="doctor_absences")
    op.drop_table("doctor_absences")
