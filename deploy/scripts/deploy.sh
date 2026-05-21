#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hb9}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

git fetch --all --prune
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

npm ci
npm run typecheck
npm run api:build
npm run build

bash deploy/scripts/migrate.sh

mkdir -p logs
pm2 startOrReload deploy/pm2/ecosystem.config.cjs --env production
pm2 save

sudo nginx -t
sudo systemctl reload nginx

bash deploy/scripts/health-check.sh
