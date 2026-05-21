# HB9 Deployment Checklist

## Frontend on Vercel

- Create a Vercel project from the repository.
- Set variables from `.env.production`.
- Use `npm run build`.
- Confirm security headers are present on the deployed domain.
- Test create/import/unlock locally before pointing users at production.

## API on VPS

1. Install Node.js 20, PostgreSQL 16, nginx, and pm2.
2. Fill `server/.env.production` on the server.
3. Apply `server/migrations/001_init.sql`.
4. Build and start:

```bash
npm ci
npm run api:build
pm2 start ecosystem.config.cjs
pm2 save
```

## Docker Compose

```bash
docker compose up --build -d
```

This starts Postgres and the API. Replace default Postgres credentials before any public deployment.

## Nginx

Use `deploy/nginx/hb9-api.conf` as a starting point, then add TLS with Certbot or your load balancer.

## Production Checks

- `GET /api/health` returns `{ success: true }`.
- CORS allows only the wallet domain.
- Rate limiting is enabled.
- No frontend or backend route accepts seed phrases, mnemonics, or private keys.
- Recharge provider secrets are configured only on the API host.
