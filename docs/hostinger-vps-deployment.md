# HB9 Hostinger VPS Deployment

This deploys HB9 on one Hostinger Ubuntu VPS:

- Next.js frontend on `127.0.0.1:3000`
- Express API on `127.0.0.1:4000`
- PostgreSQL on the same VPS, listening locally only
- Nginx exposes only `80` and `443`
- Public domains: `hb9.live`, `www.hb9.live`, `api.hb9.live`

## 1. VPS Initial Setup

Point DNS `A` records for `hb9.live`, `www.hb9.live`, and `api.hb9.live` to the VPS public IP.

SSH into the VPS as a sudo user:

```bash
ssh deploy@YOUR_VPS_IP
```

Run the base setup:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/YOUR_REPO/main/deploy/scripts/setup-vps.sh -o setup-vps.sh
bash setup-vps.sh
```

If the repo is already cloned, run:

```bash
bash deploy/scripts/setup-vps.sh
```

## 2. Node.js Install

The setup script installs Node.js 20 through NodeSource when Node 20+ is not already present.

Verify:

```bash
node -v
npm -v
pm2 -v
```

## 3. PostgreSQL Install

The setup script installs PostgreSQL and keeps it bound to localhost.

Verify:

```bash
sudo systemctl status postgresql
sudo ss -ltnp | grep 5432
```

PostgreSQL must not be opened in Hostinger firewall or UFW.

## 4. DB/User Creation

Create the local database and user:

```bash
sudo -u postgres psql
```

Inside `psql`:

```sql
CREATE DATABASE hb9_db;
CREATE USER hb9_user WITH ENCRYPTED PASSWORD 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE hb9_db TO hb9_user;
\c hb9_db
GRANT ALL ON SCHEMA public TO hb9_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO hb9_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO hb9_user;
\q
```

## 5. Clone Project

```bash
sudo mkdir -p /var/www/hb9
sudo chown "$USER:$USER" /var/www/hb9
git clone YOUR_REPOSITORY_URL /var/www/hb9
cd /var/www/hb9
```

## 6. Fill Env Files

Root `.env.production`:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.hb9.live
NEXT_PUBLIC_APP_URL=https://hb9.live
NEXT_PUBLIC_CHAIN_ID=56
NEXT_PUBLIC_USDT_TOKEN_ADDRESS=0x55d398326f99059fF775485246999027B3197955
NEXT_PUBLIC_HB_REFERRAL_REGISTRY_ADDRESS=0x0E2b46C2ECf1Ec20ddEB54cA647c3D57aDb486e
NEXT_PUBLIC_HB_TREASURY_SPLITTER_ADDRESS=0xFcCBFF3927eFFD31010a087355605aA954AB8073
NEXT_PUBLIC_HB_INCOME_DISTRIBUTOR_ADDRESS=0xC1ba0b9d3a5F8c0DCD21b747AEDF8751B836ccBf
NEXT_PUBLIC_HB_PACKAGE_MANAGER_ADDRESS=0xa9E27398023289172717729E580ed0F15AAE728e
```

Server `server/.env.production`:

```env
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://hb9.live
API_BASE_URL=https://api.hb9.live
DATABASE_URL=postgresql://hb9_user:STRONG_PASSWORD@localhost:5432/hb9_db
BSC_MAINNET_RPC_URL=
BSCSCAN_API_KEY=
USDT_TOKEN_ADDRESS=0x55d398326f99059fF775485246999027B3197955
HB_REFERRAL_REGISTRY_ADDRESS=0x0E2b46C2ECf1Ec20ddEB54cA647c3D57aDb486e
HB_TREASURY_SPLITTER_ADDRESS=0xFcCBFF3927eFFD31010a087355605aA954AB8073
HB_INCOME_DISTRIBUTOR_ADDRESS=0xC1ba0b9d3a5F8c0DCD21b747AEDF8751B836ccBf
HB_PACKAGE_MANAGER_ADDRESS=0xa9E27398023289172717729E580ed0F15AAE728e
HB_TREASURY_DEPOSIT_ADDRESS=
HB_WITHDRAWAL_VAULT_ADDRESS=
HB_WITHDRAWAL_PROVIDER_ENABLED=true
HB_WITHDRAWAL_SIGNER_PRIVATE_KEY=
```

Also fill the production-required server secrets before starting PM2:

```env
JWT_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=
ADMIN_SESSION_SECRET=
CORS_ORIGIN=https://hb9.live
```

## 7. Run Migrations

```bash
cd /var/www/hb9
bash deploy/scripts/migrate.sh
```

## 8. Build Frontend/Backend

```bash
npm ci
npm run typecheck
npm run api:build
npm run build
```

## 9. Start With PM2

```bash
mkdir -p logs
pm2 startOrReload deploy/pm2/ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd
```

Run the command printed by `pm2 startup systemd`.

## 10. Setup Nginx

```bash
sudo cp deploy/nginx/hb9.conf /etc/nginx/sites-available/hb9.conf
sudo ln -sf /etc/nginx/sites-available/hb9.conf /etc/nginx/sites-enabled/hb9.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 11. Setup SSL

```bash
sudo certbot --nginx -d hb9.live -d www.hb9.live -d api.hb9.live
sudo certbot renew --dry-run
```

Certbot will update the Nginx file with `listen 443 ssl` blocks and certificates.

## 12. Restart Commands

```bash
cd /var/www/hb9
bash deploy/scripts/restart.sh
pm2 restart hb9-web
pm2 restart hb9-api
sudo systemctl reload nginx
```

## 13. Logs Commands

```bash
pm2 status
pm2 logs hb9-web
pm2 logs hb9-api
tail -f logs/hb9-web-out.log
tail -f logs/hb9-api-out.log
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 14. Health Check Commands

```bash
cd /var/www/hb9
bash deploy/scripts/health-check.sh
curl -f https://hb9.live
curl -f https://api.hb9.live/api/health
curl -f http://127.0.0.1:3000
curl -f http://127.0.0.1:4000/api/health
```

## Standard Deploy Command

After the first setup:

```bash
cd /var/www/hb9
BRANCH=main bash deploy/scripts/deploy.sh
```
