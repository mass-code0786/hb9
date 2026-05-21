#!/usr/bin/env bash
set -euo pipefail

WEB_URL="${WEB_URL:-https://hb9.live}"
API_URL="${API_URL:-https://api.hb9.live/api/health}"

curl -fsS "$WEB_URL" >/dev/null
curl -fsS "$API_URL"
echo
pm2 status hb9-web hb9-api
