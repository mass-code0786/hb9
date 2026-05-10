create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recharge_orders (
  id uuid primary key default gen_random_uuid(),
  wallet_address text,
  country text not null,
  operator text not null,
  mobile text not null,
  amount numeric(20, 8) not null,
  asset text not null check (asset in ('BNB', 'USDT')),
  provider text not null default 'mock',
  provider_reference text,
  status text not null check (status in ('pending', 'success', 'failed')) default 'pending',
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create index if not exists idx_recharge_orders_wallet_created on recharge_orders (wallet_address, created_at desc);
create index if not exists idx_payment_orders_wallet_created on payment_orders (wallet_address, created_at desc);
create index if not exists idx_audit_logs_entity on audit_logs (entity_type, entity_id);
