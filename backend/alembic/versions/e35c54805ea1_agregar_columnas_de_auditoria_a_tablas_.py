"""Agregar columnas de auditoria a tablas con soft delete

Revision ID: e35c54805ea1
Revises: ec661d5af049
Create Date: 2026-10-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e35c54805ea1'
down_revision: Union[str, Sequence[str], None] = 'ec661d5af049'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Agregar columnas de auditoria a tablas con soft delete."""

    # users
    op.add_column(
        "users",
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("deactivated_by", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_deactivated_by",
        "users", "users",
        ["deactivated_by"], ["id"],
    )

    # patients
    op.add_column(
        "patients",
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "patients",
        sa.Column("deactivated_by", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_patients_deactivated_by",
        "patients", "users",
        ["deactivated_by"], ["id"],
    )

    # doctors
    op.add_column(
        "doctors",
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "doctors",
        sa.Column("deactivated_by", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_doctors_deactivated_by",
        "doctors", "users",
        ["deactivated_by"], ["id"],
    )
    # specialties
    op.add_column(
        "specialties",
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "specialties",
        sa.Column("deactivated_by", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_specialties_deactivated_by",
        "specialties", "users",
        ["deactivated_by"], ["id"],
    )

    # schedules
    op.add_column(
        "schedules",
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "schedules",
        sa.Column("deactivated_by", sa.Integer(), nullable=True),
    )
    op.add_column(
        "schedules",
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "schedules",
        sa.Column("closed_by", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_schedules_deactivated_by",
        "schedules", "users",
        ["deactivated_by"], ["id"],
    )
    op.create_foreign_key(
        "fk_schedules_closed_by",
        "schedules", "users",
        ["closed_by"], ["id"],
    )

def downgrade() -> None:
    """Eliminar columnas de auditoria."""

    op.drop_constraint("fk_schedules_closed_by", "schedules", type_="foreignkey")
    op.drop_constraint("fk_schedules_deactivated_by", "schedules", type_="foreignkey")
    op.drop_column("schedules", "closed_by")
    op.drop_column("schedules", "closed_at")
    op.drop_column("schedules", "deactivated_by")
    op.drop_column("schedules", "deactivated_at")

    op.drop_constraint("fk_specialties_deactivated_by", "specialties", type_="foreignkey")
    op.drop_column("specialties", "deactivated_by")
    op.drop_column("specialties", "deactivated_at")

    op.drop_constraint("fk_doctors_deactivated_by", "doctors", type_="foreignkey")
    op.drop_column("doctors", "deactivated_by")
    op.drop_column("doctors", "deactivated_at")

    op.drop_constraint("fk_patients_deactivated_by", "patients", type_="foreignkey")
    op.drop_column("patients", "deactivated_by")
    op.drop_column("patients", "deactivated_at")

    op.drop_constraint("fk_users_deactivated_by", "users", type_="foreignkey")
    op.drop_column("users", "deactivated_by")
    op.drop_column("users", "deactivated_at")
