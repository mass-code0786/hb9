# BitzenX API Server

Express + TypeScript backend for recharge and QR payment order orchestration. This server never stores seed phrases, private keys, decrypted mnemonics, or recovery phrases.

## Local Setup

```bash
npm run api:dev
```

## Build

```bash
npm run api:build
npm run api:start
```

## VPS Deployment With PM2

Fill `server/.env.production` on the VPS before starting PM2.

```bash
npm install
npm run api:build
pm2 start ecosystem.config.cjs
pm2 save
```

## Docker

```bash
docker compose up --build -d
```

## Nginx Reverse Proxy

Use `deploy/nginx/bitzenx-api.conf` for production. It routes `https://hb9.live/api/*` to the API on port `4000` and frontend traffic to Next.js on port `3000`.

## Endpoints

- `GET /api/health`
- `GET /api/recharge/countries`
- `GET /api/recharge/operators?country=IN`
- `GET /api/recharge/products?operatorId=in-airtel`
- `POST /api/recharge/quote`
- `POST /api/recharge/create`
- `POST /api/recharge/webhook`
- `GET /api/recharge/status/:orderId`
- `GET /api/recharge/history`
- `GET /api/admin/recharge/providers`
- `POST /api/admin/recharge/provider-status`
- `POST /api/payments/create`
- `GET /api/payments/history`

Recharge provider setup, webhook handling, refund review, and mock testing are documented in `docs/recharge.md`.
