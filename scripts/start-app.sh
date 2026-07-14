#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

if [ ! -d "web/node_modules" ]; then
  (cd web && npm install)
fi

echo "Starting TalentFlow API on http://127.0.0.1:8000"
uvicorn api.main:app --reload --port 8000 &
API_PID=$!

for i in $(seq 1 20); do
  if curl -sf http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    echo "API is ready."
    break
  fi
  sleep 0.5
done

trap "kill $API_PID 2>/dev/null" EXIT

echo "Starting TalentFlow UI on http://127.0.0.1:5173"
cd web && npm run dev
