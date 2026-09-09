"""RBAC role replacement (MP/District Authority/State Nodal/Ministry) + scope + investigation escalation

Revision ID: a1b2c3d4e5f6
Revises: ecf68d88d321
Create Date: 2026-09-08 00:00:00.000000

The `users.role` column is a plain VARCHAR (native_enum=False), so no DB-level
enum type needs altering — only the application's allowed values changed. But
the old role strings (ADMIN/OFFICER/ANALYST/VIEWER) are no longer valid under
the new UserRole enum, and this table only ever holds seed/demo accounts (see
scripts/seed_users.py docstring) — so existing rows are deleted here rather
than remapped; rerun seed_users.py after upgrading.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'ecf68d88d321'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users is referenced by audit_logs, investigations.assigned_to, and
    # assistant_conversations (cascading to assistant_messages) — all
    # transient demo/session data, cleared in FK-safe order before the bulk
    # delete below.
    op.execute("DELETE FROM assistant_messages")
    op.execute("DELETE FROM assistant_conversations")
    op.execute("DELETE FROM audit_logs")
    op.execute("UPDATE investigations SET assigned_to = NULL")
    op.execute("DELETE FROM users")

    op.add_column('users', sa.Column('scope_value', sa.String(length=128), nullable=True))

    op.add_column(
        'investigations',
        sa.Column(
            'current_level',
            sa.Enum('DISTRICT', 'STATE', 'MINISTRY', name='escalationlevel', native_enum=False, length=16),
            nullable=False,
            server_default='DISTRICT',
        ),
    )
    op.add_column('investigations', sa.Column('escalated_at', sa.DateTime(timezone=True), nullable=True))
    op.alter_column('investigations', 'current_level', server_default=None)


def downgrade() -> None:
    op.drop_column('investigations', 'escalated_at')
    op.drop_column('investigations', 'current_level')
    op.drop_column('users', 'scope_value')
