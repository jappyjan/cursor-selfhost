#!/usr/bin/env bash
# Restart API and web services (prod build, no hot-reload).
# Safe to run from agent: kills processes by port, not by parent PID.
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

kill_by_port() {
  local port=$1
  local pid
  pid=$(lsof -t -i:"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null || true
    for _ in {1..10}; do
      ! lsof -t -i:"$port" >/dev/null 2>&1 && break
      sleep 0.5
    done
    pid=$(lsof -t -i:"$port" 2>/dev/null || true)
    [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null || true
  fi
}

echo "Stopping API (3001) and web (5173)..."
kill_by_port 3001
kill_by_port 5173
sleep 1

echo "Running migrations..."
DATABASE_PATH="$ROOT/packages/db/data/cursor-selfhost.sqlite" pnpm --filter db migrate

echo "Building web..."
pnpm --filter web build

echo "Starting API..."
nohup pnpm --filter api start >/dev/null 2>&1 &
API_PID=$!

echo "Starting web preview..."
nohup pnpm --filter web preview >/dev/null 2>&1 &
WEB_PID=$!

echo "Restarted. API PID=$API_PID, Web PID=$WEB_PID"
echo "API: http://localhost:3001  Web: http://localhost:5173"
