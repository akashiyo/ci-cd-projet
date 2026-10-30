#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$script_dir/.."

if docker compose version >/dev/null 2>&1; then
  compose=(docker compose --env-file /dev/null)
else
  compose=(docker-compose)
fi

cleanup() {
  "${compose[@]}" rm --stop --force db backend
}

trap cleanup EXIT

"${compose[@]}" up -d --build db backend

for attempt in $(seq 1 30); do
  if curl --fail --silent http://localhost:5000/api/health > /tmp/book-catalog-health.json; then
    break
  fi

  if [ "$attempt" -eq 30 ]; then
    echo "Backend health check timed out" >&2
    exit 1
  fi

  sleep 2
done

grep --fixed-strings --quiet '"status":"ok"' /tmp/book-catalog-health.json
curl --fail --silent http://localhost:5000/books > /tmp/book-catalog-books.json
grep --fixed-strings --quiet '[' /tmp/book-catalog-books.json