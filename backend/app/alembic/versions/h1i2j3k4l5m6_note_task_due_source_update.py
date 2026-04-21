"""note_task due_at and source external_note_update

Revision ID: h1i2j3k4l5m6
Revises: g9h0i1j2k3l4
Create Date: 2026-04-20

"""

import sqlalchemy as sa
from alembic import op


revision = "h1i2j3k4l5m6"
down_revision = "g9h0i1j2k3l4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "note_task",
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "note_task",
        sa.Column("external_note_update_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_note_task_external_note_update_id_external_note_update"),
        "note_task",
        "external_note_update",
        ["external_note_update_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("fk_note_task_external_note_update_id_external_note_update"),
        "note_task",
        type_="foreignkey",
    )
    op.drop_column("note_task", "external_note_update_id")
    op.drop_column("note_task", "due_at")
