create table if not exists hb_deposit_event_logs (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  tx_hash text not null,
  log_index integer,
  block_number bigint,
  chain_id integer not null default 56,
  token_address text,
  from_address text,
  to_address text,
  amount_usd numeric(20,8),
  status text not null check (status in ('matched','unmatched','duplicate','failed')),
  deposit_id uuid references hb_deposits(id),
  error text,
  raw_event jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hb_deposit_event_logs_tx
  on hb_deposit_event_logs (lower(tx_hash));

create index if not exists idx_hb_deposit_event_logs_status
  on hb_deposit_event_logs (status, created_at desc);

create index if not exists idx_hb_deposit_event_logs_deposit
  on hb_deposit_event_logs (deposit_id);
