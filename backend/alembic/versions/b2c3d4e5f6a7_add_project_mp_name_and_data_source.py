"""add project mp_name and data_source

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-09 00:00:00.000000

Adds mp_name (real MP attribution, only populated for REAL_MPLADS-sourced
projects) and data_source (SYNTHETIC vs REAL_MPLADS) so the two datasets can
coexist and be told apart. server_default='SYNTHETIC' classifies the existing
26,634 rows correctly without a separate backfill pass.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('mp_name', sa.String(length=255), nullable=True))
    op.add_column(
        'projects',
        sa.Column(
            'data_source',
            sa.Enum('SYNTHETIC', 'REAL_MPLADS', name='datasource', native_enum=False, length=16),
            nullable=False,
            server_default='SYNTHETIC',
        ),
    )
    op.alter_column('projects', 'data_source', server_default=None)


def downgrade() -> None:
    op.drop_column('projects', 'data_source')
    op.drop_column('projects', 'mp_name')
