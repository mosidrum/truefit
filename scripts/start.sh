#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Starting Postgres…"
docker compose up -d

echo "Waiting for Postgres…"
for _ in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U truefit -d truefit >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker compose exec -T postgres pg_isready -U truefit -d truefit >/dev/null 2>&1; then
  echo "Postgres did not become ready in time." >&2
  exit 1
fi

echo "Starting web + API (Next.js) on http://localhost:3000 …"
exec npx next start
