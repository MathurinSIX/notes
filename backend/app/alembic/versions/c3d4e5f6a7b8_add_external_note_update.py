"""external note update + link history rows

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-20

"""

import sqlalchemy as sa
from alembic import op


revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "external_note_update",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("body_md", sa.Text(), nullable=False),
        sa.Column("creator_id", sa.Uuid(), nullable=False),
        sa.Column("matched_note_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("updated_ts", sa.DateTime(), nullable=False),
        sa.Column("created_ts", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["creator_id"], ["user.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["matched_note_id"], ["note.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_external_note_update_creator_id"),
        "external_note_update",
        ["creator_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_external_note_update_created_ts"),
        "external_note_update",
        ["created_ts"],
        unique=False,
    )
    op.add_column(
        "chunk_history",
        sa.Column("external_note_update_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_chunk_history_external_note_update_id_external_note_update"),
        "chunk_history",
        "external_note_update",
        ["external_note_update_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "note_history",
        sa.Column("external_note_update_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_note_history_external_note_update_id_external_note_update"),
        "note_history",
        "external_note_update",
        ["external_note_update_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("fk_note_history_external_note_update_id_external_note_update"),
        "note_history",
        type_="foreignkey",
    )
    op.drop_column("note_history", "external_note_update_id")
    op.drop_constraint(
        op.f("fk_chunk_history_external_note_update_id_external_note_update"),
        "chunk_history",
        type_="foreignkey",
    )
    op.drop_column("chunk_history", "external_note_update_id")
    op.drop_index(
        op.f("ix_external_note_update_created_ts"), table_name="external_note_update"
    )
    op.drop_index(
        op.f("ix_external_note_update_creator_id"), table_name="external_note_update"
    )
    op.drop_table("external_note_update")
