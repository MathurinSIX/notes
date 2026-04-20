"""add notes drafts chunks

Revision ID: e7a1b2c3d4e5
Revises: d4e8a1b2c3f4
Create Date: 2026-04-16 12:00:00.000000

"""

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision = "e7a1b2c3d4e5"
down_revision = "d4e8a1b2c3f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "note",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("creator_id", sa.Uuid(), nullable=False),
        sa.Column("updated_ts", sa.DateTime(), nullable=False),
        sa.Column("created_ts", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["creator_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "draft",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("body_md", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("target_note_id", sa.Uuid(), nullable=True),
        sa.Column("due_at", sa.DateTime(), nullable=True),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.Column("merged_note_id", sa.Uuid(), nullable=True),
        sa.Column("creator_id", sa.Uuid(), nullable=False),
        sa.Column("updated_ts", sa.DateTime(), nullable=False),
        sa.Column("created_ts", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["creator_id"], ["user.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["merged_note_id"], ["note.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["target_note_id"], ["note.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "chunk",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("note_id", sa.Uuid(), nullable=False),
        sa.Column("body_md", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("due_at", sa.DateTime(), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("updated_ts", sa.DateTime(), nullable=False),
        sa.Column("created_ts", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["note_id"], ["note.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "chunk_draft_link",
        sa.Column("chunk_id", sa.Uuid(), nullable=False),
        sa.Column("draft_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["chunk_id"], ["chunk.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["draft_id"], ["draft.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("chunk_id", "draft_id"),
    )
    op.create_index(op.f("ix_note_creator_id"), "note", ["creator_id"], unique=False)
    op.create_index(op.f("ix_chunk_note_id"), "chunk", ["note_id"], unique=False)
    op.create_index(op.f("ix_draft_creator_id"), "draft", ["creator_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_draft_creator_id"), table_name="draft")
    op.drop_index(op.f("ix_chunk_note_id"), table_name="chunk")
    op.drop_index(op.f("ix_note_creator_id"), table_name="note")
    op.drop_table("chunk_draft_link")
    op.drop_table("chunk")
    op.drop_table("draft")
    op.drop_table("note")
