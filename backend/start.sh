#!/bin/bash
# start.sh — Production startup script
# Runs Alembic migrations then starts the server.
# Used by Render (via render.yaml startCommand).

set -e

echo "🗄️  Running database migrations..."
cd /app
alembic upgrade head

echo "🚀 Starting VibeCode backend..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2 --log-level info
