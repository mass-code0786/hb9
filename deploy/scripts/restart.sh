#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hb9}"

cd "$APP_DIR"

pm2 restart hb9-web hb9-api --update-env
sudo nginx -t
sudo systemctl reload nginx
pm2 status
