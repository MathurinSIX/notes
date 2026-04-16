"""add user hashed_password

Revision ID: d4e8a1b2c3f4
Revises: c13f77c69939
Create Date: 2026-04-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "d4e8a1b2c3f4"
down_revision = "c13f77c69939"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column("hashed_password", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user", "hashed_password")
