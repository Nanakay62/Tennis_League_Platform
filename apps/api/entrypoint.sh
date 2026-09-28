#!/bin/sh
set -e

echo "Applying database migrations with Alembic..."
uv run alembic upgrade head

echo "Starting Uvicorn API server..."
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
