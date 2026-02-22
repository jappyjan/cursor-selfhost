#!/usr/bin/env bash
# Restart API and web services (prod build, no hot-reload).
# Safe to run from agent: kills processes by port, not by parent PID.
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

kill_by_port() {
  local port=$1
  local pids
  pids=$(lsof -t -i:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | while read -r pid; do [ -n "$pid" ] && kill "$pid" 2>/dev/null || true; done
    for _ in {1..10}; do
      ! lsof -t -i:"$port" >/dev/null 2>&1 && break
      sleep 0.5
    done
    pids=$(lsof -t -i:"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "$pids" | while read -r pid; do [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null || true; done
    fi
  fi
}

echo "Stopping API (3001) and web (5173)..."
kill_by_port 3001
kill_by_port 5173
sleep 1

# Use absolute path so migrate and API always use the same database
DB_PATH="$ROOT/packages/db/data/cursor-selfhost.sqlite"
mkdir -p "$(dirname "$DB_PATH")"

echo "Running migrations..."
DATABASE_PATH="$DB_PATH" pnpm --filter db migrate

# Fallback: ensure image_paths exists (migration 0003) — drizzle-kit may skip it in some setups
(cd "$ROOT/packages/db" && DB_PATH="$DB_PATH" pnpm exec node -e '
  const Database = require("better-sqlite3");
  const path = process.env.DB_PATH;
  if (!path) process.exit(0);
  const db = new Database(path);
  const cols = db.prepare("PRAGMA table_info(messages)").all().map((r) => r.name);
  if (!cols.includes("image_paths")) {
    try {
      db.exec("ALTER TABLE messages ADD COLUMN image_paths text");
      console.log("Applied fallback migration (image_paths)");
    } catch (e) {
      if (!e.message.includes("duplicate")) throw e;
    }
  }
  db.close();
') 2>/dev/null || true

mkdir -p "$ROOT/logs"

echo "Building web..."
pnpm --filter web build

echo "Starting API..."
DATABASE_PATH="$DB_PATH" nohup pnpm --filter api start >>"$ROOT/logs/api.log" 2>&1 &
API_PID=$!

echo "Starting web preview..."
nohup pnpm --filter web preview >>"$ROOT/logs/web.log" 2>&1 &
WEB_PID=$!

# Give services time to bind (API runs migrations before listening)
sleep 5

if lsof -t -i:3001 >/dev/null 2>&1 && lsof -t -i:5173 >/dev/null 2>&1; then
  echo "Restarted. API PID=$API_PID, Web PID=$WEB_PID"
  echo "API: http://localhost:3001  Web: http://localhost:5173"
else
  echo "WARNING: One or both services may have failed to start. Check logs/api.log and logs/web.log"
  lsof -t -i:3001 >/dev/null 2>&1 || echo "  API (3001) is NOT listening"
  lsof -t -i:5173 >/dev/null 2>&1 || echo "  Web (5173) is NOT listening"
  exit 1
fi
