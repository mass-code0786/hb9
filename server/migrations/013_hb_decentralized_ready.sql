alter table hb_internal_ledger
  add column if not exists proof_hash text,
  add column if not exists previous_proof_hash text,
  add column if not exists proof_payload_json jsonb,
  add column if not exists proof_created_at timestamptz,
  add column if not exists public_reference_id text,
  add column if not exists chain_id integer,
  add column if not exists contract_address text,
  add column if not exists onchain_tx_hash text,
  add column if not exists onchain_status text not null default 'not_applicable',
  add column if not exists onchain_synced_at timestamptz,
  add column if not exists payout_mode text not null default 'internal',
  add column if not exists treasury_wallet_address text,
  add column if not exists multisig_reference text;

alter table hb_income_ledger
  add column if not exists proof_hash text,
  add column if not exists previous_proof_hash text,
  add column if not exists proof_payload_json jsonb,
  add column if not exists proof_created_at timestamptz,
  add column if not exists public_reference_id text,
  add column if not exists chain_id integer,
  add column if not exists contract_address text,
  add column if not exists onchain_tx_hash text,
  add column if not exists onchain_status text not null default 'not_applicable',
  add column if not exists onchain_synced_at timestamptz,
  add column if not exists payout_mode text not null default 'internal',
  add column if not exists treasury_wallet_address text,
  add column if not exists multisig_reference text;

alter table hb_deposits
  add column if not exists public_reference_id text,
  add column if not exists chain_id integer,
  add column if not exists contract_address text,
  add column if not exists onchain_tx_hash text,
  add column if not exists onchain_status text not null default 'not_applicable',
  add column if not exists onchain_synced_at timestamptz,
  add column if not exists treasury_wallet_address text,
  add column if not exists multisig_reference text;

alter table hb_package_purchases
  add column if not exists public_reference_id text,
  add column if not exists chain_id integer,
  add column if not exists contract_address text,
  add column if not exists onchain_tx_hash text,
  add column if not exists onchain_status text not null default 'not_applicable',
  add column if not exists onchain_synced_at timestamptz,
  add column if not exists payout_mode text not null default 'internal',
  add column if not exists treasury_wallet_address text,
  add column if not exists multisig_reference text;

alter table hb_withdrawals
  add column if not exists public_reference_id text,
  add column if not exists chain_id integer,
  add column if not exists contract_address text,
  add column if not exists onchain_tx_hash text,
  add column if not exists onchain_status text not null default 'not_applicable',
  add column if not exists onchain_synced_at timestamptz,
  add column if not exists payout_mode text not null default 'internal',
  add column if not exists treasury_wallet_address text,
  add column if not exists multisig_reference text;

create table if not exists hb_ledger_proofs (
  id uuid primary key default gen_random_uuid(),
  public_reference_id text not null unique,
  source_table text not null check (source_table in ('hb_internal_ledger', 'hb_income_ledger')),
  ledger_entry_id uuid not null,
  user_id uuid references hb_users(id),
  masked_user_id text,
  proof_type text not null,
  amount_usd numeric(20, 8) not null default 0,
  status text,
  reference_type text,
  reference_id uuid,
  proof_hash text not null unique,
  previous_proof_hash text,
  proof_payload_json jsonb not null,
  chain_tx_hash text,
  onchain_status text not null default 'not_applicable',
  created_at timestamptz not null default now()
);

create table if not exists hb_treasury_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  wallet_address text,
  network text not null default 'bsc',
  chain_id integer not null default 56,
  label text not null,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into hb_treasury_settings (key, label)
values
  ('treasury_usdt_bep20_address', 'Treasury USDT BEP20 address'),
  ('payout_wallet_address', 'Payout wallet address'),
  ('company_reserve_wallet', 'Company reserve wallet'),
  ('product_allocation_wallet', 'Product allocation wallet'),
  ('single_leg_reserve_wallet', 'Single-leg reserve wallet')
on conflict (key) do nothing;

create table if not exists hb_wallet_auth_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references hb_users(id),
  wallet_address text not null,
  nonce text not null unique,
  message text not null,
  signature text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'expired', 'rejected')),
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_hb_ledger_proofs_hash on hb_ledger_proofs (proof_hash);
create index if not exists idx_hb_ledger_proofs_previous_hash on hb_ledger_proofs (previous_proof_hash);
create index if not exists idx_hb_ledger_proofs_public_ref on hb_ledger_proofs (public_reference_id);
create index if not exists idx_hb_ledger_proofs_user_created on hb_ledger_proofs (user_id, created_at desc);
create index if not exists idx_hb_ledger_proofs_chain_tx on hb_ledger_proofs (onchain_tx_hash) where onchain_tx_hash is not null;
create index if not exists idx_hb_internal_ledger_proof_hash on hb_internal_ledger (proof_hash);
create index if not exists idx_hb_income_ledger_proof_hash on hb_income_ledger (proof_hash);
create index if not exists idx_hb_deposits_onchain_tx on hb_deposits (onchain_tx_hash) where onchain_tx_hash is not null;
create index if not exists idx_hb_withdrawals_onchain_tx on hb_withdrawals (onchain_tx_hash) where onchain_tx_hash is not null;
create index if not exists idx_hb_wallet_auth_nonce on hb_wallet_auth_challenges (nonce);
