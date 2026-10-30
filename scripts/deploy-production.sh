#!/usr/bin/env bash
#
# Deploiement blue/green de la production.
#
# 1. determine l'instance active en lisant ACTIVE_COLOR sur le reverse proxy ;
# 2. deploie les images validees en staging sur l'instance inactive ;
# 3. verifie /api/health et le frontend directement sur cette instance ;
# 4. bascule le reverse proxy ;
# 5. verifie le proxy, et restaure l'ancienne instance en cas d'echec.
#
# L'ancienne instance n'est jamais arretee : elle sert de cible de rollback.
#
# Variables requises :
#   IMAGE_BACKEND, IMAGE_FRONTEND, IMAGE_PROXY
# Variables optionnelles :
#   PROJECT_NAME (defaut : ci-cd-projet)
#   PROXY_CONTAINER (defaut : book-reverse-proxy)
#   SKIP_PULL=1 pour un test local avec des images deja presentes.

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$script_dir/.."

project_name=${PROJECT_NAME:-ci-cd-projet}
proxy_container=${PROXY_CONTAINER:-book-reverse-proxy}
proxy_port=${PRODUCTION_PORT:-8088}

: "${IMAGE_BACKEND:?IMAGE_BACKEND doit etre defini}"
: "${IMAGE_FRONTEND:?IMAGE_FRONTEND doit etre defini}"
: "${IMAGE_PROXY:?IMAGE_PROXY doit etre defini}"

if docker compose version >/dev/null 2>&1; then
  compose=(docker compose --project-name "$project_name" -f docker-compose.yml)
else
  compose=(docker-compose --project-name "$project_name" -f docker-compose.yml)
fi

# --- Etat actuel -----------------------------------------------------------
active_color=""
previous_proxy_image=""

if docker inspect "$proxy_container" >/dev/null 2>&1; then
  active_color=$(
    docker inspect "$proxy_container" \
      --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
      | awk -F= '/^ACTIVE_COLOR=/{print $2; exit}' || true
  )
  previous_proxy_image=$(
    docker inspect "$proxy_container" --format '{{.Image}}' 2>/dev/null || true
  )
fi

case "$active_color" in
  blue|green) ;;
  *) active_color="" ;;
esac

if [ -z "$active_color" ]; then
  inactive_color=blue
  rollback_color=""
else
  if [ "$active_color" = "blue" ]; then
    inactive_color=green
  else
    inactive_color=blue
  fi
  rollback_color="$active_color"
fi

# L'image du proxy actuellement en service est conservee sous un tag dedie :
# si la nouvelle image du proxy est defectueuse, le rollback redemarre avec
# l'ancienne image plutot qu'avec celle qui vient d'echouer.
rollback_proxy_image=$IMAGE_PROXY
if [ -n "$previous_proxy_image" ]; then
  rollback_proxy_image="book-catalog-proxy:rollback"
  docker tag "$previous_proxy_image" "$rollback_proxy_image"
fi

# --- Fonctions -------------------------------------------------------------
instance_is_healthy() {
  local color=$1

  "${compose[@]}" exec -T "production-${color}-backend" node -e '
    const http = require("http");
    const req = http.get("http://127.0.0.1:5000/api/health", (res) => {
      process.exit(res.statusCode === 200 ? 0 : 1);
    });
    req.on("error", () => process.exit(1));
  ' \
    && "${compose[@]}" exec -T "production-${color}-frontend" \
      wget --quiet --spider http://127.0.0.1/ >/dev/null 2>&1
}

verify_proxy() {
  local expected_color=$1

  "${compose[@]}" exec -T -e EXPECTED_COLOR="$expected_color" \
    "production-${inactive_color}-backend" node -e '
      const http = require("http");
      const expected = process.env.EXPECTED_COLOR;
      const req = http.get("http://reverse-proxy/api/health", (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          const actual = res.headers["x-active-color"];
          if (
            res.statusCode !== 200 ||
            actual !== expected ||
            !body.includes("\"status\":\"ok\"")
          ) {
            console.error(
              `proxy check failed: status=${res.statusCode} color=${actual} body=${body}`
            );
            process.exit(1);
          }
          console.log(`reverse proxy routes to ${actual}`);
        });
      });
      req.on("error", (err) => {
        console.error(`proxy check failed: ${err.message}`);
        process.exit(1);
      });
    '
}

switch_proxy() {
  local color=$1
  local proxy_image=${2:-$IMAGE_PROXY}

  ACTIVE_COLOR="$color" IMAGE_PROXY="$proxy_image" \
    "${compose[@]}" up -d --no-build --no-deps --force-recreate reverse-proxy
}

rollback_to_previous() {
  if [ -z "$rollback_color" ]; then
    echo "Aucune instance active precedente : rollback impossible." >&2
    return 1
  fi

  echo "Rollback du reverse proxy vers production-${rollback_color}..." >&2

  if ! switch_proxy "$rollback_color" "$rollback_proxy_image"; then
    echo "Impossible de redemarrer le reverse proxy sur ${rollback_color}." >&2
    return 1
  fi

  local attempt
  for attempt in $(seq 1 15); do
    if verify_proxy "$rollback_color"; then
      echo "Rollback reussi : le proxy sert ${rollback_color}." >&2
      return 0
    fi
    sleep 2
  done

  echo "Le rollback n'a pas pu etre verifie." >&2
  return 1
}

# --- Deploiement de l'instance inactive ------------------------------------
echo "Instance active actuelle : ${active_color:-aucune}"
echo "Instance cible (inactive) : ${inactive_color}"
echo "Image backend             : ${IMAGE_BACKEND}"
echo "Image frontend            : ${IMAGE_FRONTEND}"
echo "Image reverse proxy       : ${IMAGE_PROXY}"

if [ "${SKIP_PULL:-0}" != "1" ]; then
  "${compose[@]}" pull \
    "production-${inactive_color}-backend" \
    "production-${inactive_color}-frontend" \
    reverse-proxy
fi

"${compose[@]}" up -d --no-build --no-deps --force-recreate \
  "production-${inactive_color}-backend" \
  "production-${inactive_color}-frontend"

instance_healthy=0
for attempt in $(seq 1 30); do
  if instance_is_healthy "$inactive_color"; then
    instance_healthy=1
    break
  fi
  sleep 2
done

if [ "$instance_healthy" -ne 1 ]; then
  echo "production-${inactive_color} n'est pas saine ; le proxy n'est pas bascule." >&2
  "${compose[@]}" logs --tail=50 "production-${inactive_color}-backend" >&2 || true
  "${compose[@]}" stop \
    "production-${inactive_color}-backend" \
    "production-${inactive_color}-frontend" >/dev/null 2>&1 || true
  exit 1
fi

echo "production-${inactive_color} est saine, bascule du reverse proxy..."
if ! switch_proxy "$inactive_color"; then
  echo "Echec du redemarrage du reverse proxy ; rollback." >&2
  rollback_to_previous || true
  exit 1
fi

proxy_ok=0
for attempt in $(seq 1 15); do
  if verify_proxy "$inactive_color"; then
    proxy_ok=1
    break
  fi
  sleep 2
done

if [ "$proxy_ok" -ne 1 ]; then
  echo "Le reverse proxy ne sert pas correctement ${inactive_color}." >&2
  "${compose[@]}" logs --tail=50 reverse-proxy >&2 || true
  rollback_to_previous || true
  exit 1
fi

echo "Deploiement reussi : production servie par ${inactive_color} sur le port ${proxy_port}."
echo "Ancienne instance ${rollback_color:-aucune} conservee pour un rollback manuel."
