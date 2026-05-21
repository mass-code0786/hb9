# Halal Business Final Deployment Environment Checklist

Do not deploy until every blocker is cleared. Contracts must not be deployed to BSC mainnet until after audit approval.

## Active env files

- `.env.production` for the frontend.
- `server/.env.production` for the API in production.
- `contracts/.env` for Hardhat deployment and verification.

These are the only working env files kept in the repo workspace. They are ignored by git because they are intended to hold production secrets after filling.

## Frontend env

| Variable | Status | You must provide | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | REQUIRED | Frontend public URL | Used for metadata base. |
| `NEXT_PUBLIC_SITE_URL` | OPTIONAL | Frontend public URL | Fallback for metadata base. |
| `NEXT_PUBLIC_API_URL` | REQUIRED | API public URL | Primary frontend API endpoint. |
| `NEXT_PUBLIC_API_BASE_URL` | OPTIONAL | API public URL | Fallback API endpoint. |
| `NEXT_PUBLIC_CHAIN_MODE` | REQUIRED | `mainnet` | Use `mainnet` for production. |
| `NEXT_PUBLIC_BSC_CHAIN_ID` | REQUIRED | `56` | BSC mainnet chain ID. |
| `NEXT_PUBLIC_BSC_RPC_URL` | REQUIRED | BSC mainnet RPC URL | Browser-readable RPC endpoint. |
| `NEXT_PUBLIC_BSCSCAN_URL` | REQUIRED | `https://bscscan.com` | Explorer base URL. |
| `NEXT_PUBLIC_HB_CHAIN_ID` | REQUIRED | `56` | Halal Business chain ID. |
| `NEXT_PUBLIC_HB_PACKAGE_MANAGER_ADDRESS` | REQUIRED | Deployed package manager address | Fill only after audited contract deploy. |
| `NEXT_PUBLIC_HB_USDT_ADDRESS` | REQUIRED | BSC USDT token address | Mainnet BEP20 USDT. |
| `NEXT_PUBLIC_HB_ROLLOUT_MODE` | REQUIRED | `closed_beta` first | Do not launch as public live first. |
| `NEXT_PUBLIC_HB_LAUNCH_STATUS` | OPTIONAL | Public rollout message | Display notice. |
| `NEXT_PUBLIC_HB_BYPASS_AUTH` | DO NOT USE IN PRODUCTION | `false` | Development-only bypass. |

## Backend env

| Variable | Status | You must provide | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | REQUIRED | `production` | Enables production checks. |
| `PORT` | REQUIRED | API listen port | Usually `4000`. |
| `API_PORT` | OPTIONAL | API listen port | Fallback alias for `PORT`. |
| `DATABASE_URL` | REQUIRED | PostgreSQL connection string | Production database only. |
| `CORS_ORIGIN` | REQUIRED | Frontend domain | Must not be wildcard in production. |
| `ADMIN_EMAIL` | REQUIRED | Initial/admin email | Needed for admin operations. |
| `ADMIN_PASSWORD_HASH` | REQUIRED | Bcrypt password hash | Never store plaintext password. |
| `ADMIN_SESSION_SECRET` | REQUIRED | Long random secret | Code requires this in production. |
| `HB_SESSION_SECRET` | REQUIRED | Long random secret | HB session/JWT signing input. |
| `JWT_SECRET` | REQUIRED | Long random secret | Auth token secret. |
| `HB_WALLET_SIGNATURE_AUTH_ENABLED` | REQUIRED | `true` | Keep wallet signature auth enabled. |
| `AUTO_REFUND_ENABLED` | OPTIONAL | `false` or `true` | Enable only after provider settlement testing. |
| `HB_TREASURY_DEPOSIT_ADDRESS` | REQUIRED | Fund/deposit wallet | Receives HB9 user USDT BEP20 deposits on BSC Mainnet. |
| `COMPANY_EVM_RECEIVE_ADDRESS` | LEGACY OPTIONAL | Company EVM receive wallet | Legacy alias only. Use `HB_TREASURY_DEPOSIT_ADDRESS` for HB9. |
| `COMPANY_TRON_RECEIVE_ADDRESS` | OPTIONAL | Company TRON receive wallet | Required if TRON deposits are enabled. |
| `ETH_RPC_URL` | OPTIONAL | Ethereum RPC URL | Required only for Ethereum verification flows. |
| `POLYGON_RPC_URL` | OPTIONAL | Polygon RPC URL | Required only for Polygon verification flows. |
| `USDT_TRC20_CONTRACT` | OPTIONAL | TRON USDT contract | Required only for TRON support. |
| `MIN_BLOCK_CONFIRMATIONS` | REQUIRED | Confirmation count | Suggested `3` or stricter. |
| `RATE_LIMIT_WINDOW_MS` | REQUIRED | Rate limit window | Suggested `60000`. |
| `RATE_LIMIT_MAX` | REQUIRED | Max requests per window | Set for production traffic. |
| `HB_BYPASS_AUTH` | DO NOT USE IN PRODUCTION | `false` | Development-only bypass. |
| `NEXT_PUBLIC_HB_BYPASS_AUTH` | DO NOT USE IN PRODUCTION | `false` | Development-only bypass. |

## Database env

| Variable | Status | You must provide | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | REQUIRED | PostgreSQL production URL | Database must be created before API start. |

Database checklist:

- PostgreSQL ready.
- Migrations applied from `001_init.sql` through `019_hb_internal_funds.sql`.
- Production DB credentials are not reused from `docker-compose.yml`.
- DB backup/restore process is ready before closed beta.

## Mainnet blockchain env

| Variable | Status | You must provide | Notes |
| --- | --- | --- | --- |
| `BSC_MAINNET_RPC_URL` | REQUIRED | BSC mainnet RPC URL | Required by API and contracts deploy. |
| `BSC_RPC_URL` | OPTIONAL | BSC mainnet RPC URL | Alias/fallback. |
| `BSCSCAN_API_KEY` | REQUIRED | BscScan API key | Required for contract verification. |
| `HB_CHAIN_ID` | REQUIRED | `56` | Backend chain ID. |
| `HB_PACKAGE_MANAGER_ADDRESS` | REQUIRED | Package manager address | Fill after deploy. |
| `HB_REFERRAL_REGISTRY_ADDRESS` | REQUIRED | Referral registry address | Fill after deploy. |
| `HB_TREASURY_SPLITTER_ADDRESS` | REQUIRED | Treasury splitter address | Fill after deploy. |
| `HB_INCOME_DISTRIBUTOR_ADDRESS` | REQUIRED | Income distributor address | Fill after deploy. |
| `USDT_TOKEN_ADDRESS` | REQUIRED | BSC USDT token address | Used by contracts deploy. |
| `USDT_BEP20_CONTRACT` | REQUIRED | BSC USDT token address | Used by API verification. |
| `NEXT_PUBLIC_USDT_TOKEN_ADDRESS` | REQUIRED | BSC USDT token address | Browser-readable USDT address; must be mainnet BEP20 USDT. |
| `HB_TREASURY_DEPOSIT_ADDRESS` | REQUIRED | Fund/deposit wallet | User deposits are verified against this wallet. |
| `HB_WITHDRAWAL_TREASURY_ADDRESS` | REQUIRED | Withdrawal treasury wallet | Source wallet for USDT BEP20 payouts. Must hold payout USDT. |
| `HB_WITHDRAWAL_PROVIDER_ENABLED` | REQUIRED | `false` first, then `true` | When `true`, production startup requires signer config. |
| `HB_WITHDRAWAL_SIGNER_PRIVATE_KEY` | REQUIRED WHEN WITHDRAWALS ENABLED | Withdrawal signer key | Must belong to `HB_WITHDRAWAL_TREASURY_ADDRESS`; never expose to frontend. |
| `HB_EXPLORER_BASE_URL` | REQUIRED | `https://bscscan.com` | Backend explorer links. |
| `HB_ONCHAIN_START_BLOCK` | REQUIRED | Deployment block number | Set before enabling indexer. |
| `DEPLOYER_PRIVATE_KEY` | REQUIRED | Mainnet deployer private key | Contracts env only. Never store on API server. |
| `HB_MAINNET_DEPLOY_CHECKLIST_ACK` | REQUIRED | `I_UNDERSTAND_MAINNET_DEPLOYMENT` | Set only after audit and final human approval. |
| `BSC_TESTNET_RPC_URL` | OPTIONAL | BSC testnet RPC URL | Testnet only. |

## NOWPayments env

| Variable | Status | You must provide | Notes |
| --- | --- | --- | --- |
| `NOWPAYMENTS_API_KEY` | REQUIRED | NOWPayments API key | Required for live NOWPayments. |
| `NOWPAYMENTS_IPN_SECRET` | REQUIRED | NOWPayments IPN secret | Required to validate IPN callbacks. |
| `NOWPAYMENTS_BASE_URL` | REQUIRED | `https://api.nowpayments.io/v1` | Production API URL. |
| `NOWPAYMENTS_SUCCESS_URL` | REQUIRED | Frontend success URL | Must use production HTTPS domain. |
| `NOWPAYMENTS_CANCEL_URL` | REQUIRED | Frontend cancel URL | Must use production HTTPS domain. |
| `NOWPAYMENTS_MOCK_ENABLED` | DO NOT USE IN PRODUCTION | `false` | Mock payments must stay disabled. |

## Treasury/multisig env

| Variable | Status | You must provide | Notes |
| --- | --- | --- | --- |
| `HB_MULTISIG_READY` | REQUIRED | `true` before contracts deploy | Keep `false` until multisig is funded and tested. |
| `HB_MULTISIG_OWNER_ADDRESS` | REQUIRED | Multisig owner wallet address | Receives ownership on mainnet. |
| `TREASURY_DIRECT_ADDRESS` | REQUIRED | Direct treasury address | Must be final production address. |
| `TREASURY_LEVEL_ADDRESS` | REQUIRED | Level treasury address | Must be final production address. |
| `TREASURY_COMPANY_RESERVE_ADDRESS` | REQUIRED | Company reserve / treasury hold address | Receives the 50% HB9 treasury hold. |

## HB9 wallet roles

See `docs/hb9-wallet-roles.md` for the deployment wallet structure.

- Deployer wallet: `DEPLOYER_PRIVATE_KEY` in `contracts/.env` only. Holds BNB for contract deployment gas. Do not store this key on the server.
- Fund/deposit wallet: `HB_TREASURY_DEPOSIT_ADDRESS`. Receives user USDT BEP20 deposits.
- Withdrawal treasury wallet: `HB_WITHDRAWAL_TREASURY_ADDRESS`. Pays user USDT BEP20 withdrawals.
- Direct server payout signer: `HB_WITHDRAWAL_SIGNER_PRIVATE_KEY`. Required only when `HB_WITHDRAWAL_PROVIDER_ENABLED=true`, and it must belong to `HB_WITHDRAWAL_TREASURY_ADDRESS`.
- BNB is needed only for gas in deployer and direct withdrawal signer wallets. BNB is never a user deposit or withdrawal currency.

## Safety/indexer env

| Variable | Status | You must provide | Notes |
| --- | --- | --- | --- |
| `HB_PACKAGE_PURCHASE_MODE` | REQUIRED | `onchain` | Mainnet package purchases should be on-chain. |
| `HB_PRODUCT_PURCHASE_DEBITS_COIN_USDT` | OPTIONAL | `false` or `true` | Enable only after product settlement rules are final. |
| `HB_WITHDRAWAL_DAILY_LIMIT_USD` | REQUIRED | Daily USD limit | Start conservative. |
| `HB_ONCHAIN_DRY_RUN` | REQUIRED | `false` for live indexing | Use `true` only for dry-run validation. |
| `HB_ONCHAIN_INDEXER_ENABLED` | REQUIRED | `false` first, then `true` at step 8 | Enable after contract addresses and start block are final. |
| `HB_ONCHAIN_INDEXER_INTERVAL_MS` | REQUIRED | Poll interval | Suggested `15000`. |
| `HB_ONCHAIN_INDEXER_CONFIRMATIONS` | REQUIRED | Confirmations | Suggested `3` or stricter. |
| `HB_ONCHAIN_INDEXER_BLOCK_STEP` | REQUIRED | Block batch size | Suggested `2000`. |
| `HB_MAINNET_SAFE_MODE` | REQUIRED | `true` | Keep enabled for closed beta. |
| `HB_ROLLOUT_MODE` | REQUIRED | `closed_beta` first | Required rollout mode. |
| `HB_DAILY_ACTIVATION_LIMIT` | REQUIRED | Activation limit | Suggested `25` for closed beta. |
| `HB_LIMITED_LIVE_DAILY_ACTIVATION_LIMIT` | REQUIRED | Limited-live activation limit | Suggested `25`. |
| `HB_WHITELIST_WALLETS` | REQUIRED | Comma-separated beta wallets | Required for controlled beta. |
| `HB_WHITELIST_REFERRALS` | OPTIONAL | Comma-separated referral IDs | Use if referral gating is needed. |
| `HB_ADMIN_BYPASS_WALLETS` | OPTIONAL | Comma-separated admin wallets | Keep narrow. |
| `HB_ROLLBACK_MODE` | REQUIRED | `false` | Set `true` only during rollback. |
| `HB_EMERGENCY_PAUSE` | REQUIRED | `false` | Emergency switch. |
| `HB_EMERGENCY_INDEXER_STOP` | REQUIRED | `false` | Emergency indexer stop. |
| `HB_EMERGENCY_ACTIVATION_DISABLE` | REQUIRED | `false` | Emergency activation stop. |
| `HB_EMERGENCY_WITHDRAWAL_FREEZE` | REQUIRED | `false` | Emergency withdrawal freeze. |
| `HB_EMERGENCY_TREASURY_FREEZE_NOTICE` | REQUIRED | `false` | Emergency treasury notice. |
| `HB_MAINTENANCE_NOTICE` | OPTIONAL | Notice text | Empty unless needed. |
| `HB_LAUNCH_BANNER` | OPTIONAL | Banner text | Closed-beta launch copy. |
| `HB_WARNING_BANNER` | OPTIONAL | Warning text | Limited-live warning copy. |

## Deployment readiness checklist

- [ ] PostgreSQL ready.
- [ ] Migrations applied `001` through `019`.
- [ ] Frontend build passed with `npm run build`.
- [ ] API build passed with `npm run api:build`.
- [ ] Contracts test passed with `cd contracts && npm test`.
- [ ] Multisig address ready, funded, tested, and controlled by the intended signers.
- [ ] Treasury addresses ready and verified.
- [ ] `HB_TREASURY_DEPOSIT_ADDRESS` ready and verified.
- [ ] `HB_WITHDRAWAL_TREASURY_ADDRESS` ready, funded with USDT BEP20, and funded with small BNB if direct server payouts are enabled.
- [ ] BSC mainnet RPC ready.
- [ ] BscScan API key ready.
- [ ] NOWPayments API key and IPN secret ready.
- [ ] Domain and SSL ready for frontend and API.
- [ ] Admin account ready with bcrypt password hash.
- [ ] Rollout mode set to `closed_beta` first.

## Deploy order

1. Server env: fill `server/.env.production` on the API host.
2. DB migrations: apply `server/migrations/001_init.sql` through `019_hb_internal_funds.sql`.
3. Contracts deploy only after audit: deploy to BSC mainnet only after audit approval and checklist acknowledgement.
4. Update contract addresses: fill API and frontend contract addresses from `contracts/deployments/bsc-mainnet.json`.
5. Frontend env: fill `.env.production` or hosting provider env variables.
6. Start API: build and start the API with production env.
7. Start frontend: build and start/deploy frontend.
8. Enable indexer: set `HB_ONCHAIN_INDEXER_ENABLED=true` after start block and addresses are final.
9. Closed beta test: test activation, payment, indexing, admin controls, rollback, and emergency switches.

## Missing blocker list

Fill this before deployment:

- Production PostgreSQL `DATABASE_URL`.
- Production frontend domain and API domain with SSL.
- Production `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `HB_SESSION_SECRET`, and `JWT_SECRET`.
- BSC mainnet RPC URL.
- BscScan API key.
- NOWPayments API key, IPN secret, success URL, and cancel URL.
- Multisig owner address and confirmation that `HB_MULTISIG_READY=true` is valid.
- All treasury wallet addresses.
- HB9 deposit wallet address.
- HB9 withdrawal vault address, USDT BEP20 payout liquidity, and BNB gas balance if direct server payouts are enabled.
- Contract audit approval.
- BSC mainnet deployment transaction output and deployed contract addresses.
- Indexer `HB_ONCHAIN_START_BLOCK`.
- Closed-beta wallet/referral whitelist.

## Local command list

```bash
npm ci
npm run typecheck
npm run build
npm run api:build
cd contracts && npm ci && npm test
```

Apply migrations locally with your PostgreSQL client:

```bash
psql "$DATABASE_URL" -f server/migrations/001_init.sql
psql "$DATABASE_URL" -f server/migrations/002_blockchain_verification.sql
psql "$DATABASE_URL" -f server/migrations/003_halal_business.sql
psql "$DATABASE_URL" -f server/migrations/004_halal_business_phase2.sql
psql "$DATABASE_URL" -f server/migrations/005_halal_business_distribution.sql
psql "$DATABASE_URL" -f server/migrations/006_halal_business_admin.sql
psql "$DATABASE_URL" -f server/migrations/007_halal_business_products.sql
psql "$DATABASE_URL" -f server/migrations/008_halal_business_product_images.sql
psql "$DATABASE_URL" -f server/migrations/009_halal_business_wallet_referral_link.sql
psql "$DATABASE_URL" -f server/migrations/010_hb_nowpayments_withdrawals.sql
psql "$DATABASE_URL" -f server/migrations/011_hb_production_auth.sql
psql "$DATABASE_URL" -f server/migrations/012_hb_financial_operations.sql
psql "$DATABASE_URL" -f server/migrations/013_hb_decentralized_ready.sql
psql "$DATABASE_URL" -f server/migrations/014_hb_onchain_package_purchases.sql
psql "$DATABASE_URL" -f server/migrations/015_hb_coin_balances.sql
psql "$DATABASE_URL" -f server/migrations/016_hb_wallet_first_auth.sql
psql "$DATABASE_URL" -f server/migrations/017_hb_governance_safety.sql
psql "$DATABASE_URL" -f server/migrations/018_hb_mainnet_rollout.sql
psql "$DATABASE_URL" -f server/migrations/019_hb_internal_funds.sql
```

## VPS command list

```bash
npm ci
npm run api:build
pm2 start ecosystem.config.cjs
pm2 save
```

Frontend build on the frontend host:

```bash
npm ci
npm run build
npm run start
```

Contracts commands after audit approval only:

```bash
cd contracts
npm ci
npm test
npm run deploy:bsc-mainnet
npm run verify:bsc-mainnet
```
