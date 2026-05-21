# HB9 Production Deployment

This guide deploys the Next.js frontend and Express API on one VPS behind Nginx at `https://hb9.live`.

## VPS Setup

1. Create an Ubuntu 22.04/24.04 VPS.
2. Point DNS `A` records for `hb9.live` and `www.hb9.live` to the VPS IP.
3. Install base packages:

```bash
sudo apt update
sudo apt install -y git curl nginx postgresql-client
```

## Node Install

Install Node.js 20 LTS or newer:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## Application Setup

```bash
git clone REPOSITORY_URL /var/www/hb9
cd /var/www/hb9
npm ci
npm run api:build
npm run build
```

Create `logs/` for PM2 output:

```bash
mkdir -p logs
```

## Environment Setup

Create `/var/www/hb9/.env.production` from the repo template and fill every required value:

```env
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_APP_URL=https://hb9.live
NEXT_PUBLIC_CHAIN_ID=56
NEXT_PUBLIC_USDT_TOKEN_ADDRESS=0x55d398326f99059fF775485246999027B3197955

DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DB
JWT_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=
ADMIN_SESSION_SECRET=
FRONTEND_URL=https://hb9.live
CORS_ORIGIN=https://hb9.live
API_BASE_URL=https://hb9.live

BSC_MAINNET_RPC_URL=
BSCSCAN_API_KEY=
USDT_TOKEN_ADDRESS=0x55d398326f99059fF775485246999027B3197955
HB_CHAIN_ID=56
HB_TREASURY_DEPOSIT_ADDRESS=
HB_WITHDRAWAL_PROVIDER_ENABLED=true
HB_WITHDRAWAL_SIGNER_PRIVATE_KEY=
HB_WITHDRAWAL_TREASURY_ADDRESS=
HB_PACKAGE_MANAGER_ADDRESS=
HB_REFERRAL_REGISTRY_ADDRESS=
HB_TREASURY_SPLITTER_ADDRESS=
HB_INCOME_DISTRIBUTOR_ADDRESS=
```

Never expose `HB_WITHDRAWAL_SIGNER_PRIVATE_KEY`, database credentials, JWT secrets, admin secrets, or provider secrets to the frontend.

## Database Migrations

Run migrations in order against the production database. If your deployment process does not have a migration runner yet, apply the SQL files from `server/migrations/` sequentially:

```bash
for file in server/migrations/*.sql; do psql "$DATABASE_URL" -f "$file"; done
```

## PM2 Setup

```bash
sudo npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd
```

Useful commands:

```bash
pm2 status
pm2 logs hb9-api
pm2 logs hb9-web
pm2 restart hb9-api hb9-web
pm2 reload ecosystem.config.cjs
```

## Nginx Reverse Proxy

Copy the provided config:

```bash
sudo cp deploy/nginx/bitzenx-api.conf /etc/nginx/sites-available/hb9.live
sudo ln -s /etc/nginx/sites-available/hb9.live /etc/nginx/sites-enabled/hb9.live
sudo nginx -t
sudo systemctl reload nginx
```

The config routes `/api/*` to the API on port `4000` and all frontend traffic to Next.js on port `3000`.

## SSL Setup

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d hb9.live -d www.hb9.live
sudo certbot renew --dry-run
```

## Build And Start Commands

```bash
npm run typecheck
npm run api:build
npm run build
pm2 restart ecosystem.config.cjs
```

## Startup Health Checks

After PM2 and Nginx start:

```bash
curl -f https://hb9.live/api/health
curl -f https://hb9.live/api/hb/public/landing
pm2 status
```

Confirm BSC Mainnet readiness from the admin production panel:

- chain ID is `56`
- USDT token is `0x55d398326f99059fF775485246999027B3197955`
- RPC is healthy
- contracts are deployed and verified
- withdrawal treasury has USDT and BNB for gas
- indexer is enabled and advancing

## Restart Commands

```bash
pm2 restart hb9-api
pm2 restart hb9-web
sudo systemctl reload nginx
```

## Backup Instructions

Create daily database backups:

```bash
mkdir -p /var/backups/hb9
pg_dump "$DATABASE_URL" | gzip > "/var/backups/hb9/hb9-$(date +%F-%H%M).sql.gz"
```

Back up uploaded product files:

```bash
tar -czf "/var/backups/hb9/uploads-$(date +%F-%H%M).tar.gz" public/uploads
```

Store database and upload backups outside the VPS as well. Test restore before public launch.
