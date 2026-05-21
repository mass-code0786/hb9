create extension if not exists pgcrypto;

create table if not exists hb_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  amount_usd numeric(20, 8) not null default 0,
  gross_amount numeric(20, 8),
  fee_usd numeric(20, 8) not null default 0,
  fee_amount numeric(20, 8),
  payout_amount_usd numeric(20, 8) not null default 0,
  net_amount numeric(20, 8),
  currency text not null default 'USDT',
  network text not null default 'bsc',
  wallet_address text,
  status text not null default 'pending',
  tx_hash text,
  failure_reason text,
  refund_status text,
  refund_ledger_entry_id uuid,
  reviewed_by text,
  reviewed_at timestamptz,
  approved_at timestamptz,
  processing_at timestamptz,
  paid_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_withdrawals
  add column if not exists user_id uuid,
  add column if not exists amount_usd numeric(20, 8) not null default 0,
  add column if not exists gross_amount numeric(20, 8),
  add column if not exists fee_usd numeric(20, 8) not null default 0,
  add column if not exists fee_amount numeric(20, 8),
  add column if not exists payout_amount_usd numeric(20, 8) not null default 0,
  add column if not exists net_amount numeric(20, 8),
  add column if not exists currency text not null default 'USDT',
  add column if not exists network text not null default 'bsc',
  add column if not exists wallet_address text,
  add column if not exists status text not null default 'pending',
  add column if not exists tx_hash text,
  add column if not exists failure_reason text,
  add column if not exists refund_status text,
  add column if not exists refund_ledger_entry_id uuid,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists processing_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update hb_withdrawals
set gross_amount = coalesce(gross_amount, amount_usd),
    fee_amount = coalesce(fee_amount, fee_usd, 0),
    net_amount = coalesce(net_amount, payout_amount_usd, amount_usd - coalesce(fee_usd, 0), amount_usd),
    payout_amount_usd = coalesce(payout_amount_usd, net_amount, amount_usd - coalesce(fee_usd, 0), amount_usd)
where gross_amount is null
   or fee_amount is null
   or net_amount is null
   or payout_amount_usd is null;

create table if not exists hb_package_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  package_id uuid,
  amount_usd numeric(20, 8) not null default 0,
  status text not null default 'pending',
  idempotency_key text,
  ledger_entry_id uuid,
  contract_purchase_tx_hash text,
  act_purchase_tx_hash text,
  contract_event_id text,
  block_number bigint,
  log_index integer,
  onchain_package_id integer,
  onchain_buyer_address text,
  onchain_sponsor_address text,
  onchain_status text not null default 'not_applicable',
  onchain_tx_hash text,
  chain_id integer not null default 56,
  public_reference_id text,
  payout_mode text not null default 'internal',
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_package_purchases
  add column if not exists user_id uuid,
  add column if not exists package_id uuid,
  add column if not exists amount_usd numeric(20, 8) not null default 0,
  add column if not exists status text not null default 'pending',
  add column if not exists idempotency_key text,
  add column if not exists ledger_entry_id uuid,
  add column if not exists contract_purchase_tx_hash text,
  add column if not exists act_purchase_tx_hash text,
  add column if not exists contract_event_id text,
  add column if not exists block_number bigint,
  add column if not exists log_index integer,
  add column if not exists onchain_package_id integer,
  add column if not exists onchain_buyer_address text,
  add column if not exists onchain_sponsor_address text,
  add column if not exists onchain_status text not null default 'not_applicable',
  add column if not exists onchain_tx_hash text,
  add column if not exists chain_id integer not null default 56,
  add column if not exists public_reference_id text,
  add column if not exists payout_mode text not null default 'internal',
  add column if not exists synced_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update hb_package_purchases
set act_purchase_tx_hash = coalesce(act_purchase_tx_hash, contract_purchase_tx_hash, onchain_tx_hash),
    onchain_tx_hash = coalesce(onchain_tx_hash, contract_purchase_tx_hash, act_purchase_tx_hash)
where act_purchase_tx_hash is null
   or onchain_tx_hash is null;

create table if not exists hb_income_ledger (
  id uuid primary key default gen_random_uuid(),
  earner_user_id uuid,
  source_user_id uuid,
  package_purchase_id uuid,
  income_type text not null,
  level_depth integer,
  amount_usd numeric(20, 8) not null default 0,
  credited_amount numeric(20, 8),
  capped_amount numeric(20, 8) not null default 0,
  cap_status text,
  cap_date date,
  status text not null default 'pending',
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  proof_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_income_ledger
  add column if not exists earner_user_id uuid,
  add column if not exists source_user_id uuid,
  add column if not exists package_purchase_id uuid,
  add column if not exists income_type text,
  add column if not exists level_depth integer,
  add column if not exists amount_usd numeric(20, 8) not null default 0,
  add column if not exists credited_amount numeric(20, 8),
  add column if not exists capped_amount numeric(20, 8) not null default 0,
  add column if not exists cap_status text,
  add column if not exists cap_date date,
  add column if not exists status text not null default 'pending',
  add column if not exists idempotency_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists proof_hash text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update hb_income_ledger
set credited_amount = coalesce(credited_amount, amount_usd),
    capped_amount = coalesce(capped_amount, 0)
where credited_amount is null
   or capped_amount is null;

create table if not exists hb_internal_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  wallet_type text not null default 'deposit',
  direction text not null,
  amount_usd numeric(20, 8) not null default 0,
  reference_type text,
  reference_id uuid,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  proof_hash text,
  created_at timestamptz not null default now()
);

alter table hb_internal_ledger
  add column if not exists user_id uuid,
  add column if not exists wallet_type text not null default 'deposit',
  add column if not exists direction text,
  add column if not exists amount_usd numeric(20, 8) not null default 0,
  add column if not exists reference_type text,
  add column if not exists reference_id uuid,
  add column if not exists idempotency_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists proof_hash text,
  add column if not exists created_at timestamptz not null default now();

create table if not exists hb_coin_balance_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  coin_symbol text not null default 'USDT',
  amount numeric(20, 8) not null default 0,
  amount_usd numeric(20, 8),
  type text,
  direction text not null,
  reference text,
  note text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  proof_hash text,
  created_at timestamptz not null default now()
);

alter table hb_coin_balance_ledger
  add column if not exists user_id uuid,
  add column if not exists coin_symbol text not null default 'USDT',
  add column if not exists amount numeric(20, 8) not null default 0,
  add column if not exists amount_usd numeric(20, 8),
  add column if not exists type text,
  add column if not exists direction text,
  add column if not exists reference text,
  add column if not exists note text,
  add column if not exists idempotency_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists proof_hash text,
  add column if not exists created_at timestamptz not null default now();

update hb_coin_balance_ledger
set amount_usd = coalesce(amount_usd, amount)
where amount_usd is null;

create table if not exists hb_salary_income (
  user_id uuid primary key,
  salary_amount numeric(20, 8) not null default 100,
  status text not null default 'locked',
  self_package_ok boolean not null default false,
  direct_100_count integer not null default 0,
  team_100_count integer not null default 0,
  unlocked_at timestamptz,
  paid_at timestamptz,
  ledger_reference uuid,
  proof_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_salary_income
  add column if not exists user_id uuid,
  add column if not exists salary_amount numeric(20, 8) not null default 100,
  add column if not exists status text not null default 'locked',
  add column if not exists self_package_ok boolean not null default false,
  add column if not exists direct_100_count integer not null default 0,
  add column if not exists team_100_count integer not null default 0,
  add column if not exists unlocked_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists ledger_reference uuid,
  add column if not exists proof_reference text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_single_leg_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  position_number bigint,
  sponsor_user_id uuid,
  package_amount numeric(20, 8) not null default 0,
  activated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table hb_single_leg_positions
  add column if not exists user_id uuid,
  add column if not exists position_number bigint,
  add column if not exists sponsor_user_id uuid,
  add column if not exists package_amount numeric(20, 8) not null default 0,
  add column if not exists activated_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

create table if not exists hb_single_leg_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  slab_number integer not null,
  target_members bigint not null default 0,
  reward_amount numeric(20, 8) not null default 0,
  required_direct_referrals integer not null default 0,
  actual_single_leg_members bigint not null default 0,
  actual_direct_referrals integer not null default 0,
  status text not null default 'locked',
  paid_at timestamptz,
  ledger_reference uuid,
  proof_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_single_leg_rewards
  add column if not exists user_id uuid,
  add column if not exists slab_number integer,
  add column if not exists target_members bigint not null default 0,
  add column if not exists reward_amount numeric(20, 8) not null default 0,
  add column if not exists required_direct_referrals integer not null default 0,
  add column if not exists actual_single_leg_members bigint not null default 0,
  add column if not exists actual_direct_referrals integer not null default 0,
  add column if not exists status text not null default 'locked',
  add column if not exists paid_at timestamptz,
  add column if not exists ledger_reference uuid,
  add column if not exists proof_reference text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_single_leg_reserve (
  id uuid primary key default gen_random_uuid(),
  package_purchase_id uuid,
  buyer_user_id uuid,
  package_id uuid,
  amount_usd numeric(20, 8) not null default 0,
  status text not null default 'reserved',
  ledger_entry_id uuid,
  algorithm_version text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table hb_single_leg_reserve
  add column if not exists package_purchase_id uuid,
  add column if not exists buyer_user_id uuid,
  add column if not exists package_id uuid,
  add column if not exists amount_usd numeric(20, 8) not null default 0,
  add column if not exists status text not null default 'reserved',
  add column if not exists ledger_entry_id uuid,
  add column if not exists algorithm_version text not null default 'pending',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

create table if not exists hb_user_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  package_purchase_id uuid,
  package_id uuid,
  package_name text,
  package_amount numeric(20, 8) not null default 0,
  activated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table hb_user_products
  add column if not exists user_id uuid,
  add column if not exists package_purchase_id uuid,
  add column if not exists package_id uuid,
  add column if not exists package_name text,
  add column if not exists package_amount numeric(20, 8) not null default 0,
  add column if not exists activated_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

create table if not exists hb_daily_income_caps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  cap_date date not null default current_date,
  package_amount numeric(20, 8) not null default 0,
  daily_cap_amount numeric(20, 8) not null default 0,
  credited_amount numeric(20, 8) not null default 0,
  capped_amount numeric(20, 8) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_daily_income_caps
  add column if not exists user_id uuid,
  add column if not exists cap_date date not null default current_date,
  add column if not exists package_amount numeric(20, 8) not null default 0,
  add column if not exists daily_cap_amount numeric(20, 8) not null default 0,
  add column if not exists credited_amount numeric(20, 8) not null default 0,
  add column if not exists capped_amount numeric(20, 8) not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_ledger_proofs (
  id uuid primary key default gen_random_uuid(),
  public_reference_id text,
  source_table text not null,
  ledger_entry_id uuid not null,
  user_id uuid,
  masked_user_id text,
  proof_type text,
  amount_usd numeric(20, 8) not null default 0,
  status text,
  reference_type text,
  reference_id uuid,
  proof_hash text,
  previous_proof_hash text,
  proof_payload_json jsonb,
  chain_tx_hash text,
  onchain_status text not null default 'not_applicable',
  created_at timestamptz not null default now()
);

alter table hb_ledger_proofs
  add column if not exists public_reference_id text,
  add column if not exists source_table text,
  add column if not exists ledger_entry_id uuid,
  add column if not exists user_id uuid,
  add column if not exists masked_user_id text,
  add column if not exists proof_type text,
  add column if not exists amount_usd numeric(20, 8) not null default 0,
  add column if not exists status text,
  add column if not exists reference_type text,
  add column if not exists reference_id uuid,
  add column if not exists proof_hash text,
  add column if not exists previous_proof_hash text,
  add column if not exists proof_payload_json jsonb,
  add column if not exists chain_tx_hash text,
  add column if not exists onchain_status text not null default 'not_applicable',
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_hb_withdrawals_user_requested_sync on hb_withdrawals (user_id, requested_at desc);
create index if not exists idx_hb_withdrawals_status_sync on hb_withdrawals (status, requested_at desc);
create unique index if not exists idx_hb_package_purchases_idempotency_sync on hb_package_purchases (idempotency_key);
create index if not exists idx_hb_package_purchases_user_created_sync on hb_package_purchases (user_id, created_at desc);
create index if not exists idx_hb_package_purchases_status_sync on hb_package_purchases (status, created_at desc);
create index if not exists idx_hb_package_purchases_contract_tx_sync on hb_package_purchases (contract_purchase_tx_hash) where contract_purchase_tx_hash is not null;
create index if not exists idx_hb_package_purchases_act_tx_sync on hb_package_purchases (act_purchase_tx_hash) where act_purchase_tx_hash is not null;
create unique index if not exists idx_hb_income_ledger_idempotency_sync on hb_income_ledger (idempotency_key);
create index if not exists idx_hb_income_ledger_earner_created_sync on hb_income_ledger (earner_user_id, created_at desc);
create index if not exists idx_hb_income_ledger_type_status_sync on hb_income_ledger (income_type, status, created_at desc);
create unique index if not exists idx_hb_internal_ledger_idempotency_sync on hb_internal_ledger (idempotency_key);
create index if not exists idx_hb_internal_ledger_user_created_sync on hb_internal_ledger (user_id, created_at desc);
create unique index if not exists idx_hb_coin_balance_ledger_idempotency_sync on hb_coin_balance_ledger (idempotency_key);
create index if not exists idx_hb_coin_balance_ledger_user_created_sync on hb_coin_balance_ledger (user_id, created_at desc);
create unique index if not exists idx_hb_salary_income_user_sync on hb_salary_income (user_id);
create unique index if not exists idx_hb_single_leg_positions_user_sync on hb_single_leg_positions (user_id);
create unique index if not exists idx_hb_single_leg_positions_position_sync on hb_single_leg_positions (position_number) where position_number is not null;
create unique index if not exists idx_hb_single_leg_rewards_user_slab_sync on hb_single_leg_rewards (user_id, slab_number);
create index if not exists idx_hb_single_leg_rewards_status_sync on hb_single_leg_rewards (status, updated_at desc);
create unique index if not exists idx_hb_single_leg_reserve_purchase_sync on hb_single_leg_reserve (package_purchase_id);
create index if not exists idx_hb_single_leg_reserve_buyer_sync on hb_single_leg_reserve (buyer_user_id, created_at desc);
create index if not exists idx_hb_user_products_user_sync on hb_user_products (user_id, created_at desc);
create index if not exists idx_hb_user_products_package_amount_sync on hb_user_products (package_amount);
create unique index if not exists idx_hb_daily_income_caps_user_date_sync on hb_daily_income_caps (user_id, cap_date);
create unique index if not exists idx_hb_ledger_proofs_public_reference_sync on hb_ledger_proofs (public_reference_id) where public_reference_id is not null;
create unique index if not exists idx_hb_ledger_proofs_hash_sync on hb_ledger_proofs (proof_hash) where proof_hash is not null;
create index if not exists idx_hb_ledger_proofs_ledger_sync on hb_ledger_proofs (source_table, ledger_entry_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'hb_salary_income_status_sync_check') then
    alter table hb_salary_income
      add constraint hb_salary_income_status_sync_check
      check (status in ('locked', 'unlocked', 'paid'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'hb_single_leg_rewards_status_sync_check') then
    alter table hb_single_leg_rewards
      add constraint hb_single_leg_rewards_status_sync_check
      check (status in ('locked', 'qualified', 'paid'));
  end if;
end $$;
