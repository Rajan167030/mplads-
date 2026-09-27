"""add investigation_reviews table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-27 20:20:00.000000

Investigation review findings and verdicts logged by officers.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use checkfirst / IF NOT EXISTS since table may have already been created
    op.create_table(
        'investigation_reviews',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('investigation_id', sa.UUID(), nullable=False),
        sa.Column('reviewer_id', sa.UUID(), nullable=False),
        sa.Column('verdict', sa.String(length=32), nullable=False),
        sa.Column('findings', sa.Text(), nullable=False),
        sa.Column('recommendation', sa.Text(), nullable=True),
        sa.Column('evidence_references', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['investigation_id'], ['investigations.id'], ),
        sa.ForeignKeyConstraint(['reviewer_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )
    op.create_index(op.f('ix_investigation_reviews_investigation_id'), 'investigation_reviews', ['investigation_id'], unique=False, if_not_exists=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_investigation_reviews_investigation_id'), table_name='investigation_reviews', if_exists=True)
    op.drop_table('investigation_reviews', if_exists=True)
