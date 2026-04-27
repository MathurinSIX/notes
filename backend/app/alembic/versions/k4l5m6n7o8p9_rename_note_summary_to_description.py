"""rename note.summary to description

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-04-27

"""

import sqlalchemy as sa
from alembic import op

revision = "k4l5m6n7o8p9"
down_revision = "j3k4l5m6n7o8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "note",
        "summary",
        new_column_name="description",
        existing_type=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "note_history",
        "summary",
        new_column_name="description",
        existing_type=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "note",
        "description",
        new_column_name="summary",
        existing_type=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "note_history",
        "description",
        new_column_name="summary",
        existing_type=sa.Text(),
        existing_nullable=True,
    )
