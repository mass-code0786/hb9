alter table hb_deposits
  add column if not exists provider text not null default 'manual',
  add column if not exists payment_id text,
  add column if not exists pay_address text,
  add column if not exists pay_currency text,
  add column if not exists price_amount numeric(20, 8),
  add column if not exists pay_amount numeric(36, 18),
  add column if not exists payment_status text,
  add column if not exists payment_order_id text,
  add column if not exists payment_purchase_id text,
  add column if not exists payment_invoice_url text,
  add column if not exists payment_raw jsonb not null default '{}'::jsonb;

create unique index if not exists idx_hb_deposits_payment_id_unique
  on hb_deposits (payment_id)
  where payment_id is not null;

create table if not exists hb_deposit_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'nowpayments',
  payment_id text,
  deposit_id uuid references hb_deposits(id),
  signature text,
  signature_valid boolean not null default false,
  payment_status text,
  payload jsonb not null,
  processed boolean not null default false,
  processing_error text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_hb_deposit_webhook_status_once
  on hb_deposit_webhook_logs (provider, payment_id, payment_status)
  where signature_valid = true and payment_id is not null and payment_status is not null;

create table if not exists hb_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id),
  wallet_type text not null default 'deposit' check (wallet_type in ('deposit', 'income')),
  amount_usd numeric(20, 8) not null,
  currency text not null default 'USDT',
  network text not null default 'bsc',
  wallet_address text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'processing', 'paid', 'rejected', 'failed')),
  reserve_ledger_entry_id uuid references hb_internal_ledger(id),
  refund_ledger_entry_id uuid references hb_internal_ledger(id),
  paid_ledger_entry_id uuid references hb_internal_ledger(id),
  tx_hash text,
  failure_reason text,
  admin_note text,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  rejected_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists hb_withdrawal_audit_logs (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid references hb_withdrawals(id),
  user_id uuid references hb_users(id),
  admin_email text,
  action text not null,
  previous_status text,
  next_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_hb_withdrawals_user_created on hb_withdrawals (user_id, requested_at desc);
create index if not exists idx_hb_withdrawals_status_created on hb_withdrawals (status, requested_at desc);

alter table hb_users
  add column if not exists usdt_bep20_address text,
  add column if not exists wallet_bound_at timestamptz,
  add column if not exists wallet_updated_at timestamptz;

create index if not exists idx_hb_users_usdt_bep20_address on hb_users (usdt_bep20_address);
