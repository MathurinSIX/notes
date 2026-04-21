"""add pasted_image for API-backed note images

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-04-21

"""

import sqlalchemy as sa
from alembic import op


revision = "j3k4l5m6n7o8"
down_revision = "i2j3k4l5m6n7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pasted_image",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("object_key", sa.String(length=1024), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=False),
        sa.Column("created_ts", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pasted_image_user_id"), "pasted_image", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_pasted_image_user_id"), table_name="pasted_image")
    op.drop_table("pasted_image")
