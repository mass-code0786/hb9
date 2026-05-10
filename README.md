# BitzenX Production Wallet MVP

Mobile-first Binance Smart Chain wallet built with Next.js App Router, TypeScript, Tailwind CSS, ethers.js, Framer Motion, Zustand, React Query, local Web Crypto encryption, PWA support, and an Express API scaffold.

## What Works

- Create/import 12-word BIP39 wallets
- Password-protected local AES-GCM vault
- Lock, unlock, remove wallet, refresh lock, and inactivity auto-lock
- Seed phrase warning modal and confirm backup phrase screen
- Multi-network asset dashboard for BSC, Ethereum, Polygon, Arbitrum, Optimism, Avalanche, Tron placeholder, Solana placeholder, and Bitcoin watch-only placeholder
- Native EVM and ERC20/BEP20 balance loading on supported EVM networks
- Receive address with QR code and network-specific explorer links
- Send EVM native assets and configured ERC20/BEP20 tokens with gas estimation
- Markets, Trade, Rewards, and Discover wallet modules
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
NEXT_PUBLIC_ETH_RPC_URL=https://ethereum.publicnode.com
NEXT_PUBLIC_POLYGON_RPC_URL=https://polygon-rpc.com
NEXT_PUBLIC_ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
NEXT_PUBLIC_OPTIMISM_RPC_URL=https://mainnet.optimism.io
NEXT_PUBLIC_AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
NEXT_PUBLIC_CHAIN_MODE=mainnet
NEXT_PUBLIC_BSC_CHAIN_ID=56
NEXT_PUBLIC_USDT_BEP20_ADDRESS=0x55d398326f99059fF775485246999027B3197955
NEXT_PUBLIC_BSCSCAN_URL=https://bscscan.com
NEXT_PUBLIC_APP_NAME=BitzenX
NEXT_PUBLIC_RECHARGE_PROVIDER=mock
NEXT_PUBLIC_MARKETS_PROVIDER=mock

API_PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bitzenx
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
RECHARGE_PROVIDER=mock
AUTO_REFUND_ENABLED=false
RELOADLY_CLIENT_ID=
RELOADLY_CLIENT_SECRET=
DTONE_API_KEY=
DTONE_API_SECRET=
DING_API_KEY=
```

## BSC Testnet Testing

For real user testing without mainnet funds, set:

```bash
NEXT_PUBLIC_CHAIN_MODE=testnet
NEXT_PUBLIC_BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
NEXT_PUBLIC_BSC_CHAIN_ID=97
NEXT_PUBLIC_BSCSCAN_URL=https://testnet.bscscan.com
NEXT_PUBLIC_USDT_BEP20_ADDRESS=<your test BEP20 token>
```

Get test BNB from the official BNB Chain testnet faucet, send it to the BitzenX receive address, and verify transactions on BscScan testnet. BitzenX runs as a standalone self-custody wallet and does not auto-detect or connect browser wallet extensions. More manual QA notes are in `docs/testing.md`.

## Backend

Run locally:

```bash
npm run api:dev
```

Endpoints:

- `GET /api/health`
- `POST /api/recharge/quote`
- `POST /api/recharge/create`
- `POST /api/recharge/webhook`
- `GET /api/recharge/countries`
- `GET /api/recharge/operators?country=IN`
- `GET /api/recharge/products?operatorId=in-airtel`
- `GET /api/recharge/status/:orderId`
- `GET /api/recharge/history`
- `GET /api/admin/recharge/providers`
- `POST /api/admin/recharge/provider-status`
- `POST /api/admin/login`
- `GET /api/admin/summary`
- `GET /api/admin/recharge-orders`
- `GET /api/admin/payment-orders`
- `GET /api/admin/users`
- `GET /api/admin/audit-logs`
- `GET /api/admin/provider-settings`
- `GET /api/admin/fees`
- `POST /api/payments/create`
- `GET /api/payments/history`

Apply `server/migrations/001_init.sql` with your PostgreSQL migration tool. The schema includes `users`, `recharge_orders`, `payment_orders`, `audit_logs`, and `api_provider_settings`.

Server deployment notes, PM2 command, and an nginx reverse proxy sample are in `server/README.md`.

## Provider Integration

The recharge provider layer supports `mock`, `reloadly`, `dtone`, and `ding` modes behind a factory. See `docs/recharge.md` for mock testing, live provider setup, webhook handling, order states, refunds, and security notes.

Admin dashboard setup, credentials, provider safety, fee settings, recharge operations, and refund review are documented in `docs/admin.md`.

## Verification

```bash
npm run typecheck
npm run build
npm run api:build
npm run qa
npm run test:e2e
```

## Deploy

Frontend: deploy to Vercel with the `NEXT_PUBLIC_*` variables.

Backend: deploy `server/` to a Node.js host or VPS, set `API_PORT`, `DATABASE_URL`, `CORS_ORIGIN`, rate-limit values, and provider credentials, run migrations, then start with `npm run api:start` after `npm run api:build`. For PM2 and nginx examples, see `server/README.md`.

## Security Notes

- Mnemonic generation/import happens only in the browser.
- EVM networks derive the same address from the local mnemonic path. Tron, Solana, and Bitcoin are clearly labeled placeholders until separate derivation/signing is implemented safely.
- The mnemonic is encrypted locally using Web Crypto AES-GCM before `localStorage` persistence.
- The decrypted mnemonic is memory-only, so browser refresh locks the wallet.
- The user password is never stored.
- The mnemonic and private key are never sent to backend routes.
- Backend request middleware rejects sensitive wallet-material keys.
- The existing signing path remains local through ethers.js.
- Unsupported networks do not show fake successful sends; send actions are disabled until implemented.
- Avoid logging private keys or recovery phrases in future integrations.
- Complete an external security review before handling meaningful funds.

## Remaining TODOs

- Add a real QR scanner decoder library and device compatibility tests.
- Connect DT One, Reloadly, or Ding credentials and webhooks.
- Add authenticated admin tooling for provider settings and audit review.
- Add integration tests against BSC testnet before mainnet funds.
