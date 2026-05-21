create table if not exists hb_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text not null,
  referral_code text not null unique,
  sponsor_user_id uuid references hb_users(id),
  status text not null default 'inactive' check (status in ('inactive', 'active', 'suspended', 'blocked')),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id),
  network text not null default 'bsc',
  wallet_address text,
  wallet_type text not null default 'deposit' check (wallet_type in ('deposit', 'recharge', 'income')),
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, wallet_type, network)
);

create table if not exists hb_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount_usd numeric(20, 8) not null unique,
  status text not null default 'available' check (status in ('available', 'disabled')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_referrals (
  id uuid primary key default gen_random_uuid(),
  sponsor_user_id uuid not null references hb_users(id),
  referred_user_id uuid not null unique references hb_users(id),
  level_depth integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists hb_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id),
  wallet_address text,
  network text not null default 'bsc',
  asset text not null default 'USDT' check (asset in ('BNB', 'USDT')),
  amount numeric(36, 18) not null,
  usd_amount numeric(20, 8) not null,
  tx_hash text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'failed')),
  chain_id integer,
  from_address text,
  to_address text,
  confirmations integer,
  verified_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_internal_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references hb_users(id),
  wallet_type text not null check (wallet_type in ('deposit', 'recharge', 'income', 'company')),
  direction text not null check (direction in ('credit', 'debit')),
  amount_usd numeric(20, 8) not null,
  reference_type text not null,
  reference_id uuid,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists hb_package_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id),
  package_id uuid not null references hb_packages(id),
  amount_usd numeric(20, 8) not null,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'reversed')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists hb_activation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id),
  package_purchase_id uuid references hb_package_purchases(id),
  previous_status text not null,
  new_status text not null,
  created_at timestamptz not null default now()
);

create table if not exists hb_income_ledger (
  id uuid primary key default gen_random_uuid(),
  earner_user_id uuid references hb_users(id),
  source_user_id uuid references hb_users(id),
  package_purchase_id uuid references hb_package_purchases(id),
  income_type text not null check (income_type in ('upline', 'level', 'single_leg', 'product_value', 'recharge_credit', 'company')),
  amount_usd numeric(20, 8) not null,
  status text not null default 'pending' check (status in ('pending', 'credited', 'company_allocated', 'failed', 'cancelled')),
  level_depth integer,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists hb_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references hb_users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into hb_packages (name, amount_usd, status, sort_order)
values
  ('Starter Package', 4, 'available', 1),
  ('Builder Package', 20, 'available', 2),
  ('Growth Package', 100, 'available', 3),
  ('Business Package', 500, 'available', 4),
  ('Premium Package', 2500, 'available', 5),
  ('Enterprise Package', 12500, 'available', 6)
on conflict (amount_usd) do update
set name = excluded.name,
    status = excluded.status,
    sort_order = excluded.sort_order,
    updated_at = now();

create unique index if not exists idx_hb_deposits_tx_hash_unique
  on hb_deposits (lower(tx_hash))
  where tx_hash is not null;

create index if not exists idx_hb_users_sponsor on hb_users (sponsor_user_id);
create index if not exists idx_hb_purchases_user_created on hb_package_purchases (user_id, created_at desc);
create index if not exists idx_hb_income_user_created on hb_income_ledger (earner_user_id, created_at desc);
create index if not exists idx_hb_ledger_user_wallet_created on hb_internal_ledger (user_id, wallet_type, created_at desc);
create index if not exists idx_hb_audit_user_created on hb_audit_logs (user_id, created_at desc);
