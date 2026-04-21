"""note_task_history append-only task snapshots

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-04-20

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "i2j3k4l5m6n7"
down_revision: str | None = "h1i2j3k4l5m6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "note_task_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("editor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "external_note_update_id", postgresql.UUID(as_uuid=True), nullable=True
        ),
        sa.Column("changed_ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("done", sa.Boolean(), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("deleted", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["editor_id"],
            ["user.id"],
            name=op.f("fk_note_task_history_editor_id_user"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["external_note_update_id"],
            ["external_note_update.id"],
            name=op.f(
                "fk_note_task_history_external_note_update_id_external_note_update"
            ),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["note_id"],
            ["note.id"],
            name=op.f("fk_note_task_history_note_id_note"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_note_task_history")),
    )
    op.create_index(
        op.f("ix_note_task_history_note_id"),
        "note_task_history",
        ["note_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_note_task_history_changed_ts"),
        "note_task_history",
        ["changed_ts"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_note_task_history_changed_ts"), table_name="note_task_history"
    )
    op.drop_index(op.f("ix_note_task_history_note_id"), table_name="note_task_history")
    op.drop_table("note_task_history")
