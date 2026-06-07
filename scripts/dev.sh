#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ENV_FILE="$ROOT/config/athql.env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  echo "Loaded config from config/athql.env"
fi

if [ ! -d "$ROOT/backend/.venv" ]; then
  python3 -m venv "$ROOT/backend/.venv"
  "$ROOT/backend/.venv/bin/pip" install -r "$ROOT/backend/requirements.txt"
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  (cd "$ROOT/frontend" && npm install)
fi

trap 'kill 0' EXIT

(
  cd "$ROOT/backend"
  export PYTHONPATH="$ROOT/backend"
  "$ROOT/backend/.venv/bin/uvicorn" app.main:app --reload --host 127.0.0.1 --port 8000
) &

(
  cd "$ROOT/frontend"
  npm run dev
) &

wait
