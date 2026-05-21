alter table hb_coin_balance_ledger
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists proof_hash text,
  add column if not exists previous_proof_hash text,
  add column if not exists proof_payload_json jsonb,
  add column if not exists proof_created_at timestamptz,
  add column if not exists public_reference_id text,
  add column if not exists onchain_tx_hash text,
  add column if not exists onchain_status text not null default 'not_applicable';

alter table hb_ledger_proofs drop constraint if exists hb_ledger_proofs_source_table_check;
alter table hb_ledger_proofs
  add constraint hb_ledger_proofs_source_table_check
  check (source_table in ('hb_internal_ledger', 'hb_income_ledger', 'hb_coin_balance_ledger'));

create table if not exists hb_internal_transfers (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references hb_users(id),
  receiver_user_id uuid not null references hb_users(id),
  coin_symbol text not null check (coin_symbol in ('USDT', 'ADA', 'DOGE', 'SHIB', 'PEPE', 'BTCT')),
  amount numeric(28, 8) not null check (amount > 0),
  type text not null default 'admin_transfer',
  note text not null,
  admin_id text not null,
  sender_ledger_entry_id uuid references hb_coin_balance_ledger(id),
  receiver_ledger_entry_id uuid references hb_coin_balance_ledger(id),
  proof_reference text,
  sender_before_balance numeric(28, 8) not null default 0,
  sender_after_balance numeric(28, 8) not null default 0,
  receiver_before_balance numeric(28, 8) not null default 0,
  receiver_after_balance numeric(28, 8) not null default 0,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  check (sender_user_id <> receiver_user_id)
);

create table if not exists hb_admin_balance_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id),
  coin_symbol text not null check (coin_symbol in ('USDT', 'ADA', 'DOGE', 'SHIB', 'PEPE', 'BTCT')),
  amount numeric(28, 8) not null check (amount > 0),
  type text not null check (type in ('credit', 'deduct', 'bulk_distribution')),
  note text not null,
  admin_id text not null,
  ledger_entry_id uuid references hb_coin_balance_ledger(id),
  proof_reference text,
  before_balance numeric(28, 8) not null default 0,
  after_balance numeric(28, 8) not null default 0,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_hb_internal_transfers_sender on hb_internal_transfers (sender_user_id, created_at desc);
create index if not exists idx_hb_internal_transfers_receiver on hb_internal_transfers (receiver_user_id, created_at desc);
create index if not exists idx_hb_admin_balance_actions_user on hb_admin_balance_actions (user_id, created_at desc);
