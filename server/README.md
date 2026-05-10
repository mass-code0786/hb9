# BitzenX API Server

Express + TypeScript backend for recharge and QR payment order orchestration. This server never stores seed phrases, private keys, decrypted mnemonics, or recovery phrases.

## Local Setup

```bash
cp server/.env.example server/.env
npm run api:dev
```

## Build

```bash
npm run api:build
npm run api:start
```

## VPS Deployment With PM2

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

```nginx
server {
  server_name api.example.com;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

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
