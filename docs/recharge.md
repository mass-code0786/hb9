# Recharge System

BitzenX recharge is structured as a provider-backed order flow. Wallet signing remains local in the browser; the API only receives recharge metadata and a confirmed blockchain transaction hash.

## Environment

```bash
RECHARGE_PROVIDER=mock
AUTO_REFUND_ENABLED=false
COMPANY_EVM_RECEIVE_ADDRESS=
COMPANY_TRON_RECEIVE_ADDRESS=
USDT_BEP20_CONTRACT=0x55d398326f99059fF775485246999027B3197955
USDT_TRC20_CONTRACT=TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj
BSC_RPC_URL=https://bsc-dataseed.binance.org
ETH_RPC_URL=https://ethereum.publicnode.com
POLYGON_RPC_URL=https://polygon-rpc.com
RECHARGE_WEBHOOK_SECRET=
MIN_BLOCK_CONFIRMATIONS=3

RELOADLY_CLIENT_ID=
RELOADLY_CLIENT_SECRET=
DTONE_API_KEY=
DTONE_API_SECRET=
DING_API_KEY=
```

Allowed `RECHARGE_PROVIDER` values are `mock`, `reloadly`, `dtone`, and `ding`.

## Mock Testing

1. Start the app and API in mock mode.
2. Open Recharge.
3. Select a country, mobile number, operator, and plan.
4. Generate a quote and review local currency, FX, fee, crypto amount, and ETA.
5. Paste a confirmed test transaction hash and submit.
6. Use a hash containing `fail` to simulate provider failure and refund review.

Mock mode includes sample countries, operators, products, quote conversion, provider success/failure simulation, webhook-compatible status handling, and history. Recharge order creation still requires a real verified on-chain payment transaction for the selected network/token.

## Blockchain Verification

`POST /api/recharge/create` verifies the submitted transaction before a provider order is created. Verification checks transaction existence, chain, success status, recipient, token contract, amount, minimum confirmations, and duplicate tx hash use.

Supported verification paths:

- BSC native BNB to `COMPANY_EVM_RECEIVE_ADDRESS`
- BSC USDT BEP20 to `COMPANY_EVM_RECEIVE_ADDRESS`
- TRON USDT TRC20 to `COMPANY_TRON_RECEIVE_ADDRESS`

Unsupported chains or tokens return a 400 response and do not create a successful order.

## Webhook Signatures

Provider webhooks require:

- `x-bitzenx-timestamp`: Unix timestamp in milliseconds, within 5 minutes
- `x-bitzenx-signature`: HMAC-SHA256 hex digest, optionally prefixed with `sha256=`

The signed payload is `${timestamp}.${JSON.stringify(body)}` using `RECHARGE_WEBHOOK_SECRET`.

## API Surface

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

Admin provider endpoints return readiness/configuration flags only. They never return provider secrets.

## Order Lifecycle

1. `awaiting_payment`: quote created and user is expected to pay locally.
2. `payment_detected`: API received a tx hash after user confirmation.
3. `processing_recharge`: provider request is in progress.
4. `success`: provider completed the top-up.
5. `failed`: recharge cannot continue.
6. `refund_pending`: provider failed after crypto payment and admin review is required.
7. `refunded`: refund has been confirmed and recorded.

## Refund Lifecycle

Provider failures create a refund record with `admin_review_required=true`. `AUTO_REFUND_ENABLED=false` is the safe default. Do not enable automatic refunds until transaction validation, provider reconciliation, and admin review tooling are complete.

## Live Provider Setup

Reloadly, DT One, and Ding provider files are in place behind the factory. The current live-provider classes validate credentials and preserve the interface, but the actual provider HTTP calls, auth token refresh, product normalization, and webhook signature verification still need provider-specific implementation before production traffic.

## Security Notes

- API payloads are validated with zod.
- Recharge routes are covered by the global API rate limiter.
- Sensitive wallet material is rejected by API middleware.
- The backend must never receive seed phrases, mnemonics, or private keys.
- Crypto signing and broadcasting must remain in the local BitzenX wallet.
- Phone numbers are sanitized before quote/order creation.
- Recharge quote, create, webhook, status, and refund-review actions are audit logged.
