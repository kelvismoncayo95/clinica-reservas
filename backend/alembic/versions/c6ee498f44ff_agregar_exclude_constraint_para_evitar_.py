"""Agregar EXCLUDE constraint para evitar solapamiento de citas

Revision ID: c6ee498f44ff
Revises: d09df7b5a36e
Create Date: 2026-09-23

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c6ee498f44ff'
down_revision: Union[str, Sequence[str], None] = 'd09df7b5a36e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Agrega constraint de exclusion para evitar solapamiento de citas confirmadas."""
    op.execute(
        """
        ALTER TABLE appointments
        ADD CONSTRAINT no_overlapping_confirmed_appointments
        EXCLUDE USING gist (
            doctor_id WITH =,
            tsrange(
                (appointment_date + start_time)::timestamp,
                (appointment_date + end_time)::timestamp
            ) WITH &&
        ) WHERE (status = 'confirmed')
        """
    )


def downgrade() -> None:
    """Elimina el constraint de exclusion."""
    op.execute(
        "ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_overlapping_confirmed_appointments"
    )
