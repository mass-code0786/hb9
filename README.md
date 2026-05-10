# BitzenX Production Wallet MVP

Mobile-first Binance Smart Chain wallet built with Next.js App Router, TypeScript, Tailwind CSS, ethers.js, Framer Motion, Zustand, React Query, local Web Crypto encryption, PWA support, and an Express API scaffold.

## What Works

- Create/import 12-word BIP39 wallets
- Password-protected local AES-GCM vault
- Lock, unlock, remove wallet, refresh lock, and inactivity auto-lock
- Seed phrase warning modal and confirm backup phrase screen
- BNB and BEP20 USDT balances on BSC
- Receive address with QR code
- Send BNB and USDT with gas estimation
- Trust Wallet style dark mobile home with search, centered total balance, action buttons, tabs, token list, and fixed bottom nav
- Recharge UI with 100+ country structure, operator/amount/payment preview/history, and mock provider abstraction
- QR Pay UI with camera permission, manual QR fallback, merchant/petrol payment confirmation, and success/failure states
- Token management, transaction history, security center, settings, install prompt, service worker, and offline page
- Express + TypeScript backend scaffold with PostgreSQL migrations and provider-ready APIs

## Security Model

BitzenX is self-custody. The browser creates/imports the wallet, encrypts the mnemonic locally, and signs transactions locally with ethers.js. The backend must never receive, log, store, or derive seed phrases, mnemonics, or private keys. API middleware rejects payloads containing sensitive wallet-material keys.

## Structure

```txt
app/             Next.js routes, layout, global CSS, offline screen
components/      Wallet shell, PWA helpers, shared UI primitives
features/        Home, recharge, QR pay, security, tokens, transactions, settings
hooks/           React Query/state-derived hooks
lib/             Existing wallet, chain, storage, crypto, config logic
services/        Mock APIs and provider abstractions
server/          Express API, provider interface, PostgreSQL migrations
store/           Zustand wallet/token/recharge/transaction/settings stores
types/           App feature types
utils/           Formatting helpers
public/          PWA manifest, service worker, app icon
```

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment

```bash
NEXT_PUBLIC_BSC_RPC_URL=https://bsc-dataseed.binance.org
NEXT_PUBLIC_BSC_CHAIN_ID=56
NEXT_PUBLIC_USDT_BEP20_ADDRESS=0x55d398326f99059fF775485246999027B3197955
NEXT_PUBLIC_BSCSCAN_URL=https://bscscan.com
NEXT_PUBLIC_APP_NAME=BitzenX
NEXT_PUBLIC_RECHARGE_PROVIDER=mock
NEXT_PUBLIC_MARKETS_PROVIDER=mock

API_PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bitzenx
RECHARGE_PROVIDER=mock
```

## Backend

Run locally:

```bash
npm run api:dev
```

Endpoints:

- `GET /api/health`
- `POST /api/recharge/quote`
- `POST /api/recharge/create`
- `GET /api/recharge/history`
- `POST /api/payments/create`
- `GET /api/payments/history`

Apply `server/migrations/001_init.sql` with your PostgreSQL migration tool. The schema includes `users`, `recharge_orders`, `payment_orders`, `audit_logs`, and `api_provider_settings`.

## Provider Integration

`server/src/providers/rechargeProvider.ts` defines the provider interface. Add DT One, Reloadly, or Ding implementations behind that interface, store encrypted provider credentials in `api_provider_settings`, and process provider webhooks into `recharge_orders` plus `audit_logs`.

## Verification

```bash
npm run typecheck
npm run build
npm run api:build
```

## Deploy

Frontend: deploy to Vercel with the `NEXT_PUBLIC_*` variables.

Backend: deploy `server/` to a Node.js host, set `API_PORT`, `DATABASE_URL`, and provider credentials, run migrations, then start with `npm run api:start` after `npm run api:build`.

## Security Notes

- Mnemonic generation/import happens only in the browser.
- The mnemonic is encrypted locally using Web Crypto AES-GCM before `localStorage` persistence.
- The decrypted mnemonic is memory-only, so browser refresh locks the wallet.
- The user password is never stored.
- The mnemonic and private key are never sent to backend routes.
- Backend request middleware rejects sensitive wallet-material keys.
- The existing signing path remains local through ethers.js.
- Avoid logging private keys or recovery phrases in future integrations.
- Complete an external security review before handling meaningful funds.

## Remaining TODOs

- Add a real QR scanner decoder library and device compatibility tests.
- Connect DT One, Reloadly, or Ding credentials and webhooks.
- Add authenticated admin tooling for provider settings and audit review.
- Add integration tests against BSC testnet before mainnet funds.
