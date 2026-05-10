# Admin Panel

BitzenX Admin is an operations dashboard for recharge orders, QR payment orders, provider settings, fees, users/activity, and audit logs. It is intentionally separated from wallet custody code and must never access seed phrases, private keys, mnemonics, or decrypted wallet data.

## Environment

```bash
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=<sha256-password-hash>
ADMIN_SESSION_SECRET=<long-random-secret>
```

`ADMIN_PASSWORD_HASH` is a SHA-256 hex hash of the admin password. Store only the hash in environment variables.

## Routes

- `/admin/login`
- `/admin`
- `/admin/recharge-orders`
- `/admin/payment-orders`
- `/admin/users`
- `/admin/provider-settings`
- `/admin/fees`
- `/admin/audit-logs`
- `/admin/settings`

## Login Flow

The admin API verifies `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`, then issues a signed session token. Admin API routes require `Authorization: Bearer <token>`. Logout clears the client session token.

## API Endpoints

- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`
- `GET /api/admin/summary`
- `GET /api/admin/recharge-orders`
- `GET /api/admin/recharge-orders/:id`
- `PATCH /api/admin/recharge-orders/:id`
- `GET /api/admin/payment-orders`
- `GET /api/admin/payment-orders/:id`
- `PATCH /api/admin/payment-orders/:id`
- `GET /api/admin/users`
- `GET /api/admin/audit-logs`
- `GET /api/admin/provider-settings`
- `POST /api/admin/provider-settings/test`
- `POST /api/admin/provider-settings/active`
- `GET /api/admin/fees`
- `POST /api/admin/fees`

All responses use `{ success, data, message, error }`.

## Provider Settings Safety

Provider screens show status, active provider, webhook URL, test connection controls, and masked key indicators only. Full provider API secrets are never returned to the frontend.

## Fee Settings

Admins can configure recharge percentage fee, fixed fee, minimum fee, QR pay percentage fee, refund fee, and supported crypto symbols. Fee changes are audit logged.

## Recharge Operations

Admins can review recharge orders, inspect transaction hashes and provider IDs, retry provider requests, mark failed, mark refund pending, mark refunded, and add notes. Phone numbers are masked in list views.

## Refund Process

Provider failures should move orders to `refund_pending` and create an admin-review workflow. Keep `AUTO_REFUND_ENABLED=false` until reconciliation and refund tooling are fully reviewed.

## Security Notes

- Admin routes are protected by signed tokens.
- Admin actions are audit logged.
- API payloads are zod validated.
- Rate limiting applies globally, including admin login.
- Admin screens never expose wallet secrets or provider secrets.
- Wallet signing remains local in the BitzenX self-custody wallet.

