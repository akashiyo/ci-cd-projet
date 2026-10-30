#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$script_dir/.."

if docker compose version >/dev/null 2>&1; then
  compose=(docker compose --env-file /dev/null --project-name book-catalog-integration -f docker-compose.yml -f tests/docker-compose.integration.yml)
else
  compose=(docker-compose --project-name book-catalog-integration -f docker-compose.yml -f tests/docker-compose.integration.yml)
fi

  integration_network=book-catalog-integration_default
  curl_image=curlimages/curl:8.10.1

cleanup() {
  "${compose[@]}" rm --stop --force db backend
}

trap cleanup EXIT

BACKEND_PORT=5001 "${compose[@]}" up -d --build db backend

for attempt in $(seq 1 30); do
  if docker run --rm --network "$integration_network" "$curl_image" \
    --fail --silent http://backend:5000/api/health > /tmp/book-catalog-health.json; then
    break
  fi

  if [ "$attempt" -eq 30 ]; then
    echo "Backend health check timed out" >&2
    exit 1
  fi

  sleep 2
done

grep --fixed-strings --quiet '"status":"ok"' /tmp/book-catalog-health.json
docker run --rm --network "$integration_network" "$curl_image" \
  --fail --silent http://backend:5000/books > /tmp/book-catalog-books.json
grep --fixed-strings --quiet '[' /tmp/book-catalog-books.json