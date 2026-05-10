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
pm2 start server/dist/index.js --name bitzenx-api
pm2 save
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
- `POST /api/recharge/quote`
- `POST /api/recharge/create`
- `GET /api/recharge/history`
- `POST /api/payments/create`
- `GET /api/payments/history`
