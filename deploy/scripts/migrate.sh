#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hb9}"
ENV_FILE="${ENV_FILE:-$APP_DIR/server/.env.production}"

cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing server env file: $ENV_FILE"
  exit 1
fi

DATABASE_URL="${DATABASE_URL:-$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -n 1 | cut -d= -f2-)}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required in $ENV_FILE"
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());"

shopt -s nullglob
mapfile -t migrations < <(printf '%s\n' server/migrations/*.sql | sort -V)

if [[ "${#migrations[@]}" -eq 0 ]]; then
  echo "No migrations found in server/migrations"
  exit 0
fi

for migration in "${migrations[@]}"; do
  filename="$(basename "$migration")"
  force_repair="false"
  if [[ "$filename" == "999_hb9_production_schema_repair.sql" ]]; then
    force_repair="true"
  fi

  already_applied="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At -v filename="$filename" -c "SELECT 1 FROM schema_migrations WHERE filename = :'filename' LIMIT 1;")"
  if [[ "$already_applied" == "1" && "$force_repair" != "true" ]]; then
    echo "Skipping $filename"
    continue
  fi

  if [[ "$force_repair" == "true" && "$already_applied" == "1" ]]; then
    echo "Reapplying idempotent repair $filename"
  else
    echo "Applying $filename"
  fi
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
    -v filename="$filename" \
    -c "BEGIN;" \
    -f "$migration" \
    -c "INSERT INTO schema_migrations (filename) VALUES (:'filename') ON CONFLICT (filename) DO UPDATE SET applied_at = now();" \
    -c "COMMIT;"
done
