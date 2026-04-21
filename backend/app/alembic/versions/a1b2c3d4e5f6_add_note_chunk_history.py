"""add note and chunk history tables

Revision ID: a1b2c3d4e5f6
Revises: f8c9d0e1a2b3
Create Date: 2026-04-20

"""

import sqlalchemy as sa
import sqlmodel
from alembic import op
from sqlalchemy import text


revision = "a1b2c3d4e5f6"
down_revision = "f8c9d0e1a2b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "note_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("note_id", sa.Uuid(), nullable=False),
        sa.Column("editor_id", sa.Uuid(), nullable=True),
        sa.Column("changed_ts", sa.DateTime(), nullable=False),
        sa.Column(
            "title", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True
        ),
        sa.Column("archived", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["editor_id"], ["user.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["note_id"], ["note.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "chunk_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("note_id", sa.Uuid(), nullable=False),
        sa.Column("chunk_id", sa.Uuid(), nullable=False),
        sa.Column("editor_id", sa.Uuid(), nullable=True),
        sa.Column("changed_ts", sa.DateTime(), nullable=False),
        sa.Column("body_md", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("due_at", sa.DateTime(), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("deleted", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["editor_id"], ["user.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["note_id"], ["note.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_note_history_note_id"), "note_history", ["note_id"], unique=False
    )
    op.create_index(
        op.f("ix_note_history_changed_ts"),
        "note_history",
        ["changed_ts"],
        unique=False,
    )
    op.create_index(
        op.f("ix_chunk_history_note_id"), "chunk_history", ["note_id"], unique=False
    )
    op.create_index(
        op.f("ix_chunk_history_changed_ts"),
        "chunk_history",
        ["changed_ts"],
        unique=False,
    )

    # gen_random_uuid() is PG13+ / pgcrypto; uuid-ossp works on older Postgres images.
    op.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
    op.execute(
        text("""
        INSERT INTO note_history (id, note_id, editor_id, changed_ts, title, archived)
        SELECT uuid_generate_v4(), n.id, n.creator_id, n.created_ts, n.title, n.archived
        FROM note n
        """)
    )
    op.execute(
        text("""
        INSERT INTO chunk_history (
            id, note_id, chunk_id, editor_id, changed_ts,
            body_md, sort_order, due_at, completed, deleted
        )
        SELECT
            uuid_generate_v4(),
            c.note_id,
            c.id,
            n.creator_id,
            c.created_ts,
            c.body_md,
            c.sort_order,
            c.due_at,
            c.completed,
            false
        FROM chunk c
        JOIN note n ON n.id = c.note_id
        """)
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_chunk_history_changed_ts"), table_name="chunk_history")
    op.drop_index(op.f("ix_chunk_history_note_id"), table_name="chunk_history")
    op.drop_index(op.f("ix_note_history_changed_ts"), table_name="note_history")
    op.drop_index(op.f("ix_note_history_note_id"), table_name="note_history")
    op.drop_table("chunk_history")
    op.drop_table("note_history")
