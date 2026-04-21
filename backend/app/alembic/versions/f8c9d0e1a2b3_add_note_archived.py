"""add note archived flag

Revision ID: f8c9d0e1a2b3
Revises: e7a1b2c3d4e5
Create Date: 2026-04-20

"""

import sqlalchemy as sa
from alembic import op


revision = "f8c9d0e1a2b3"
down_revision = "e7a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "note",
        sa.Column(
            "archived",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.alter_column("note", "archived", server_default=None)


def downgrade() -> None:
    op.drop_column("note", "archived")
