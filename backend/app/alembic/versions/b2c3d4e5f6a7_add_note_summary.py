"""add note summary text field

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-20

"""

import sqlalchemy as sa
from alembic import op


revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("note", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column("note_history", sa.Column("summary", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("note_history", "summary")
    op.drop_column("note", "summary")
