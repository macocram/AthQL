#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ENV_FILE="$ROOT/config/athql.env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  echo "Loaded config from config/athql.env"
  if [ -n "${ATHQL_DEV_HOST:-}" ] || [ -n "${ATHQL_DEV_ORIGINS:-}" ]; then
    echo "Custom dev UI origins enabled (ATHQL_DEV_HOST / ATHQL_DEV_ORIGINS)"
  fi
fi

if [ ! -d "$ROOT/backend/.venv" ]; then
  python3 -m venv "$ROOT/backend/.venv"
  "$ROOT/backend/.venv/bin/pip" install -r "$ROOT/backend/requirements.txt"
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  (cd "$ROOT/frontend" && npm install)
fi

trap 'kill 0' EXIT

DEV_PORT="${ATHQL_DEV_PORT:-5173}"
echo "AthQL UI: http://localhost:${DEV_PORT}"
if [ -n "${ATHQL_DEV_HOST:-}" ]; then
  echo "AthQL UI (custom host): http://${ATHQL_DEV_HOST}:${DEV_PORT}  (must use http + port ${DEV_PORT})"
fi

(
  cd "$ROOT/backend"
  export PYTHONPATH="$ROOT/backend"
  "$ROOT/backend/.venv/bin/uvicorn" app.main:app --reload --host 127.0.0.1 --port 8000
) &

(
  cd "$ROOT/frontend"
  export ATHQL_DEV_HOST="${ATHQL_DEV_HOST:-}"
  export ATHQL_DEV_ORIGINS="${ATHQL_DEV_ORIGINS:-}"
  export ATHQL_DEV_PORT="${DEV_PORT}"
  npm run dev
) &

wait
