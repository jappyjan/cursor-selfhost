#!/usr/bin/env bash
# Stop API and web services by killing processes on their ports.
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
echo "Stopped."
