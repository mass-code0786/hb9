create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recharge_countries_cache (
  code text primary key,
  name text not null,
  currency text not null,
  dial_code text not null,
  flag text,
  provider text not null default 'mock',
  payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);

create table if not exists recharge_operators_cache (
  id text primary key,
  country_code text not null,
  name text not null,
  logo_url text,
  provider text not null default 'mock',
  payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);

create table if not exists recharge_products_cache (
  id text primary key,
  operator_id text not null,
  name text not null,
  local_currency text not null,
  local_amount numeric(20, 8) not null,
  validity text,
  provider text not null default 'mock',
  payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);

create table if not exists recharge_quotes (
  id uuid primary key default gen_random_uuid(),
  user_wallet_address text,
  country_code text not null,
  operator_id text not null,
  operator_name text not null,
  phone_number text not null,
  local_currency text not null,
  local_amount numeric(20, 8) not null,
  usd_amount numeric(20, 8) not null,
  fx_rate numeric(20, 10) not null,
  platform_fee numeric(20, 8) not null,
  crypto_symbol text not null check (crypto_symbol in ('BNB', 'USDT')),
  crypto_amount numeric(20, 8) not null,
  network text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists recharge_orders (
  id uuid primary key default gen_random_uuid(),
  user_wallet_address text,
  country_code text not null,
  operator_id text not null,
  operator_name text not null,
  phone_number text not null,
  local_currency text not null,
  local_amount numeric(20, 8) not null,
  crypto_symbol text not null check (crypto_symbol in ('BNB', 'USDT')),
  crypto_amount numeric(20, 8) not null,
  network text not null,
  tx_hash text,
  provider text not null default 'mock',
  provider_order_id text,
  status text not null check (status in ('awaiting_payment', 'payment_detected', 'processing_recharge', 'success', 'failed', 'refund_pending', 'refunded')) default 'awaiting_payment',
  failure_reason text,
  refund_status text not null default 'none' check (refund_status in ('none', 'review_required', 'pending', 'refunded', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recharge_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references recharge_orders(id),
  tx_hash text,
  crypto_symbol text not null check (crypto_symbol in ('BNB', 'USDT')),
  crypto_amount numeric(20, 8) not null,
  status text not null default 'review_required' check (status in ('review_required', 'pending', 'refunded', 'rejected')),
  admin_review_required boolean not null default true,
  refund_tx_hash text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recharge_provider_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  action text not null,
  order_id uuid,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  status_code integer,
  created_at timestamptz not null default now()
);

create table if not exists payment_orders (
  id uuid primary key default gen_random_uuid(),
  wallet_address text,
  merchant_name text not null,
  merchant_address text not null,
  category text not null check (category in ('merchant', 'petrol', 'personal')),
  amount numeric(20, 8) not null,
  asset text not null check (asset in ('BNB', 'USDT')),
  qr_mode text not null check (qr_mode in ('static', 'dynamic')),
  tx_hash text,
  status text not null check (status in ('pending', 'success', 'failed')) default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_wallet_address text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists api_provider_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  enabled boolean not null default false,
  base_url text,
  encrypted_credentials jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recharge_orders_wallet_created on recharge_orders (user_wallet_address, created_at desc);
create index if not exists idx_recharge_orders_provider_order on recharge_orders (provider_order_id);
create index if not exists idx_recharge_quotes_wallet_created on recharge_quotes (user_wallet_address, created_at desc);
create index if not exists idx_recharge_refunds_order on recharge_refunds (order_id);
create index if not exists idx_payment_orders_wallet_created on payment_orders (wallet_address, created_at desc);
create index if not exists idx_audit_logs_entity on audit_logs (entity_type, entity_id);
