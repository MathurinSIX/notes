#! /usr/bin/env bash

set -e
set -x

# Let the DB start
python app/backend_pre_start.py

# Run migrations (uv: dev bind-mount may not have .venv on PATH until uv sync)
uv run alembic upgrade head

# Create initial data in DB
python app/initial_data.py

# Clean old runs where status=started
#python app/clean_runs.py