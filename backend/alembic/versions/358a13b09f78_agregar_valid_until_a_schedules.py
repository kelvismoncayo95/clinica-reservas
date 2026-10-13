"""Agregar valid_until a schedules

Revision ID: 358a13b09f78
Revises: c6ee498f44ff
Create Date: 2026-10-12 23:01:23.595148

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '358a13b09f78'
down_revision: Union[str, Sequence[str], None] = 'c6ee498f44ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
