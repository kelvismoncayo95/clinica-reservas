"""Agregar valid_until a schedules

Revision ID: ec661d5af049
Revises: 358a13b09f78
Create Date: 2026-10-12 23:03:15.498425

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ec661d5af049'
down_revision: Union[str, Sequence[str], None] = '358a13b09f78'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Agregar columna valid_until a schedules."""
    op.add_column(
        "schedules",
        sa.Column("valid_until", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    """Eliminar columna valid_until de schedules."""
    op.drop_column("schedules", "valid_until")
