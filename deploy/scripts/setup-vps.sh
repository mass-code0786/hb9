#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hb9}"
APP_USER="${APP_USER:-$USER}"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this script as the deployment user with sudo access, not as root."
  exit 1
fi

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git nginx postgresql postgresql-contrib ufw

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

sudo npm install -g pm2
sudo apt-get install -y certbot python3-certbot-nginx

sudo install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR"
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw --force enable

sudo sed -i "s/^#listen_addresses =.*/listen_addresses = 'localhost'/" /etc/postgresql/*/main/postgresql.conf
sudo systemctl enable postgresql nginx
sudo systemctl restart postgresql
sudo systemctl restart nginx

echo "Base VPS setup complete. Create the database/user next, then clone the project into $APP_DIR."
