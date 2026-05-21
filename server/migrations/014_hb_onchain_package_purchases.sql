alter table hb_package_purchases
  add column if not exists contract_purchase_tx_hash text,
  add column if not exists contract_event_id text,
  add column if not exists block_number bigint,
  add column if not exists log_index integer,
  add column if not exists onchain_package_id integer,
  add column if not exists onchain_buyer_address text,
  add column if not exists onchain_sponsor_address text,
  add column if not exists onchain_status text not null default 'not_applicable',
  add column if not exists synced_at timestamptz;

alter table hb_product_orders
  add column if not exists contract_purchase_tx_hash text,
  add column if not exists contract_event_id text,
  add column if not exists block_number bigint,
  add column if not exists log_index integer,
  add column if not exists onchain_package_id integer,
  add column if not exists onchain_buyer_address text,
  add column if not exists onchain_sponsor_address text,
  add column if not exists onchain_status text not null default 'not_applicable',
  add column if not exists synced_at timestamptz;

create table if not exists hb_onchain_contracts (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  chain_id integer not null default 56,
  contract_address text,
  start_block bigint,
  enabled boolean not null default false,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into hb_onchain_contracts (key)
values
  ('package_manager'),
  ('referral_registry'),
  ('treasury_splitter'),
  ('income_distributor'),
  ('usdt_bep20')
on conflict (key) do nothing;

create table if not exists hb_onchain_purchase_events (
  id uuid primary key default gen_random_uuid(),
  contract_event_id text unique,
  tx_hash text not null,
  chain_id integer not null default 56,
  contract_address text,
  block_number bigint,
  log_index integer,
  onchain_package_id integer,
  buyer_user_id uuid references hb_users(id),
  buyer_address text not null,
  sponsor_address text,
  referral_code text,
  amount_usd numeric(20, 8) not null,
  status text not null default 'submitted' check (status in ('submitted', 'pending', 'confirmed', 'failed', 'ignored')),
  raw_event jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_onchain_sync_logs (
  id uuid primary key default gen_random_uuid(),
  contract_key text not null,
  from_block bigint,
  to_block bigint,
  status text not null default 'pending',
  events_found integer not null default 0,
  error text,
  triggered_by text,
  created_at timestamptz not null default now()
);

create table if not exists hb_onchain_sync_cursors (
  contract_key text primary key,
  chain_id integer not null default 97,
  contract_address text,
  last_synced_block bigint not null default 0,
  last_checked_block bigint,
  last_status text not null default 'idle',
  last_error text,
  updated_at timestamptz not null default now()
);

create table if not exists hb_onchain_failed_events (
  id uuid primary key default gen_random_uuid(),
  contract_event_id text,
  tx_hash text not null,
  chain_id integer not null default 97,
  block_number bigint,
  log_index integer,
  error text not null,
  raw_event jsonb not null default '{}'::jsonb,
  retry_count integer not null default 0,
  next_retry_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'retrying', 'resolved', 'ignored')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_hb_onchain_purchase_event_log
  on hb_onchain_purchase_events (chain_id, tx_hash, log_index)
  where log_index is not null;

create index if not exists idx_hb_onchain_purchase_buyer on hb_onchain_purchase_events (buyer_user_id, created_at desc);
create index if not exists idx_hb_onchain_purchase_status on hb_onchain_purchase_events (status, created_at desc);
create index if not exists idx_hb_onchain_failed_retry on hb_onchain_failed_events (status, next_retry_at);
create index if not exists idx_hb_package_purchases_contract_event on hb_package_purchases (contract_event_id) where contract_event_id is not null;
create index if not exists idx_hb_package_purchases_tx on hb_package_purchases (contract_purchase_tx_hash) where contract_purchase_tx_hash is not null;
