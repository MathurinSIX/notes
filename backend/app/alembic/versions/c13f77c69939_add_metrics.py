"""Add metrics

Revision ID: c13f77c69939
Revises: 145b46b7993d
Create Date: 2025-10-01 13:28:10.281449

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'c13f77c69939'
down_revision = '145b46b7993d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "http_request_metrics",
        sa.Column(
            "ts",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("method", sa.String(), nullable=False),
        sa.Column("path_template", sa.String(), nullable=False),
        sa.Column("status", sa.Integer(), nullable=False),
        sa.Column("duration_ms", sa.Float(), nullable=False),
        sa.Column("client_ip", postgresql.INET(), nullable=True)
    )
    op.create_index("ix_http_request_metrics_ts", "http_request_metrics", ["ts"])
    op.create_index("ix_http_request_metrics_path_template", "http_request_metrics", ["path_template"])

    op.create_table(
        "app_liveness",
        sa.Column(
            "ts",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("pod_name", sa.Text()),
        sa.Column('pid', sa.Integer, nullable=True),
    )
    op.create_index("ix_app_liveness_ts", "app_liveness", ["ts"])
    op.create_index("ix_app_liveness_pod_name", "app_liveness", ["pod_name"])


def downgrade() -> None:
    op.drop_index("ix_http_request_metrics_ts", table_name="http_request_metrics")
    op.drop_index("ix_http_request_metrics_path_template", table_name="http_request_metrics")
    op.drop_table("http_request_metrics")
    op.drop_index("ix_app_liveness_ts", table_name="app_liveness")
    op.drop_index("ix_app_liveness_pod_name", table_name="app_liveness")
    op.drop_table("app_liveness")