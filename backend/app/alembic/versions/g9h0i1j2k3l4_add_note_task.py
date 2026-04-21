"""note_task table for workflow-generated follow-ups

Revision ID: g9h0i1j2k3l4
Revises: c3d4e5f6a7b8
Create Date: 2026-04-20

"""

import sqlalchemy as sa
from alembic import op


revision = "g9h0i1j2k3l4"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "note_task",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("note_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("done", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("updated_ts", sa.DateTime(), nullable=False),
        sa.Column("created_ts", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["note_id"], ["note.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_note_task_note_id"),
        "note_task",
        ["note_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_note_task_note_id"), table_name="note_task")
    op.drop_table("note_task")
