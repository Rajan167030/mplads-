"""add complaints table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-09 00:00:00.000000

Anonymous, geo-verified citizen complaints against a project. No user_id
column by design — there's nothing here to attach an identity to.
anonymous_token is the submitter's own receipt for a later status check.
submitted_geom mirrors projects.geom (PostGIS POINT, SRID 4326) so distance
checks reuse the same ST_Distance/Geography-cast pattern already used for
"related projects nearby" (see app.graph.relationships).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'complaints',
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('photo_data', sa.LargeBinary(), nullable=False),
        sa.Column('photo_content_type', sa.String(length=64), nullable=False),
        sa.Column('submitted_latitude', sa.Float(), nullable=False),
        sa.Column('submitted_longitude', sa.Float(), nullable=False),
        sa.Column('submitted_geom', Geometry(geometry_type='POINT', srid=4326), nullable=False),
        sa.Column('distance_to_project_m', sa.Float(), nullable=True),
        sa.Column('is_location_verified', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            'status',
            sa.Enum('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED', name='complaintstatus', native_enum=False, length=16),
            nullable=False,
            server_default='PENDING',
        ),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('anonymous_token', sa.String(length=64), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_complaints_project_id'), 'complaints', ['project_id'], unique=False)
    op.create_index(op.f('ix_complaints_anonymous_token'), 'complaints', ['anonymous_token'], unique=True)
    op.alter_column('complaints', 'is_location_verified', server_default=None)
    op.alter_column('complaints', 'status', server_default=None)


def downgrade() -> None:
    op.drop_index(op.f('ix_complaints_anonymous_token'), table_name='complaints')
    op.drop_index(op.f('ix_complaints_project_id'), table_name='complaints')
    op.drop_table('complaints')
