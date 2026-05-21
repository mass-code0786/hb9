-- Idempotent HB9 production schema repair for VPS databases that drifted from
-- the latest HB9 route/service code while older migrations were already marked applied.

create table if not exists hb_coin_balances (
  user_id uuid not null references hb_users(id) on delete cascade,
  coin_symbol text not null,
  balance numeric(38, 18) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, coin_symbol)
);

alter table hb_users
  add column if not exists hb9_wallet_address text;

do $$
declare
  legacy_wallet_column text := 'bit' || 'zenx_wallet_address';
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'hb_users' and column_name = legacy_wallet_column
  ) then
    execute format(
      'update hb_users set hb9_wallet_address = coalesce(hb9_wallet_address, %1$I) where hb9_wallet_address is null and %1$I is not null',
      legacy_wallet_column
    );
  end if;
end $$;

create table if not exists hb_coin_balance_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  coin_symbol text not null,
  amount numeric(38, 18) not null check (amount > 0),
  usd_price numeric(28, 12),
  usd_value numeric(28, 8),
  type text not null,
  direction text not null check (direction in ('credit', 'debit')),
  reference text,
  reference_id text,
  admin_id text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  proof_hash text,
  previous_proof_hash text,
  proof_payload_json jsonb,
  proof_created_at timestamptz,
  public_reference_id text,
  onchain_tx_hash text,
  onchain_status text not null default 'not_applicable',
  created_at timestamptz not null default now()
);

alter table hb_coin_balances
  alter column balance type numeric(38, 18),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table hb_coin_balances drop constraint if exists hb_coin_balances_coin_symbol_check;
delete from hb_coin_balances where coin_symbol = 'ETH';
update hb_coin_balances set coin_symbol = 'BTTC' where coin_symbol = 'BTCT';
alter table hb_coin_balances
  add constraint hb_coin_balances_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_coin_balance_ledger
  alter column amount type numeric(38, 18),
  add column if not exists usd_price numeric(28, 12),
  add column if not exists usd_value numeric(28, 8),
  add column if not exists reference_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists proof_hash text,
  add column if not exists previous_proof_hash text,
  add column if not exists proof_payload_json jsonb,
  add column if not exists proof_created_at timestamptz,
  add column if not exists public_reference_id text,
  add column if not exists onchain_tx_hash text,
  add column if not exists onchain_status text not null default 'not_applicable';

alter table hb_coin_balance_ledger drop constraint if exists hb_coin_balance_ledger_coin_symbol_check;
delete from hb_coin_balance_ledger where coin_symbol = 'ETH';
update hb_coin_balance_ledger set coin_symbol = 'BTTC' where coin_symbol = 'BTCT';
alter table hb_coin_balance_ledger
  add constraint hb_coin_balance_ledger_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_coin_balance_ledger drop constraint if exists hb_coin_balance_ledger_type_check;
alter table hb_coin_balance_ledger
  add constraint hb_coin_balance_ledger_type_check
  check (type in (
    'credit', 'debit', 'earning', 'withdrawal', 'admin', 'manual',
    'admin_credit', 'admin_debit', 'convert_debit', 'convert_credit',
    'convert_credit_usdt', 'convert_credit_hb9',
    'deposit_credit', 'withdrawal_debit', 'withdrawal_fee'
  ));

alter table hb_withdrawals
  add column if not exists gross_amount numeric(20, 8),
  add column if not exists fee_amount numeric(20, 8),
  add column if not exists net_amount numeric(20, 8);

update hb_withdrawals
set gross_amount = coalesce(gross_amount, amount_usd),
    fee_amount = coalesce(fee_amount, fee_usd),
    net_amount = coalesce(net_amount, payout_amount_usd)
where gross_amount is null or fee_amount is null or net_amount is null;

alter table hb_package_purchases
  add column if not exists ledger_entry_id uuid references hb_internal_ledger(id),
  add column if not exists contract_purchase_tx_hash text,
  add column if not exists act_purchase_tx_hash text,
  add column if not exists contract_event_id text,
  add column if not exists block_number bigint,
  add column if not exists log_index integer,
  add column if not exists onchain_package_id integer,
  add column if not exists onchain_buyer_address text,
  add column if not exists onchain_sponsor_address text,
  add column if not exists onchain_status text not null default 'not_applicable',
  add column if not exists synced_at timestamptz,
  add column if not exists public_reference_id text,
  add column if not exists chain_id integer,
  add column if not exists contract_address text,
  add column if not exists onchain_tx_hash text,
  add column if not exists onchain_synced_at timestamptz,
  add column if not exists payout_mode text not null default 'internal',
  add column if not exists treasury_wallet_address text,
  add column if not exists multisig_reference text;

update hb_package_purchases
set act_purchase_tx_hash = coalesce(act_purchase_tx_hash, contract_purchase_tx_hash, onchain_tx_hash)
where act_purchase_tx_hash is null;

alter table hb_product_orders
  add column if not exists contract_purchase_tx_hash text,
  add column if not exists act_purchase_tx_hash text,
  add column if not exists contract_event_id text,
  add column if not exists block_number bigint,
  add column if not exists log_index integer,
  add column if not exists onchain_package_id integer,
  add column if not exists onchain_buyer_address text,
  add column if not exists onchain_sponsor_address text,
  add column if not exists onchain_status text not null default 'not_applicable',
  add column if not exists synced_at timestamptz;

update hb_product_orders
set act_purchase_tx_hash = coalesce(act_purchase_tx_hash, contract_purchase_tx_hash)
where act_purchase_tx_hash is null;

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

alter table hb_onchain_contracts
  add column if not exists chain_id integer not null default 56,
  add column if not exists contract_address text,
  add column if not exists start_block bigint,
  add column if not exists enabled boolean not null default false,
  add column if not exists updated_by text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

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
  status text not null default 'submitted',
  raw_event jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_onchain_purchase_events
  add column if not exists contract_event_id text,
  add column if not exists tx_hash text,
  add column if not exists chain_id integer not null default 56,
  add column if not exists contract_address text,
  add column if not exists block_number bigint,
  add column if not exists log_index integer,
  add column if not exists onchain_package_id integer,
  add column if not exists buyer_user_id uuid references hb_users(id),
  add column if not exists buyer_address text,
  add column if not exists sponsor_address text,
  add column if not exists referral_code text,
  add column if not exists amount_usd numeric(20, 8),
  add column if not exists status text not null default 'submitted',
  add column if not exists raw_event jsonb not null default '{}'::jsonb,
  add column if not exists synced_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

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

alter table hb_onchain_sync_logs
  add column if not exists contract_key text,
  add column if not exists from_block bigint,
  add column if not exists to_block bigint,
  add column if not exists status text not null default 'pending',
  add column if not exists events_found integer not null default 0,
  add column if not exists error text,
  add column if not exists triggered_by text,
  add column if not exists created_at timestamptz not null default now();

create table if not exists hb_onchain_sync_cursors (
  contract_key text primary key,
  chain_id integer not null default 56,
  contract_address text,
  last_synced_block bigint not null default 0,
  last_checked_block bigint,
  last_status text not null default 'idle',
  last_error text,
  updated_at timestamptz not null default now()
);

alter table hb_onchain_sync_cursors
  add column if not exists chain_id integer not null default 56,
  add column if not exists contract_address text,
  add column if not exists last_synced_block bigint not null default 0,
  add column if not exists last_checked_block bigint,
  add column if not exists last_status text not null default 'idle',
  add column if not exists last_error text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_onchain_failed_events (
  id uuid primary key default gen_random_uuid(),
  contract_event_id text,
  tx_hash text not null,
  chain_id integer not null default 56,
  block_number bigint,
  log_index integer,
  error text not null,
  raw_event jsonb not null default '{}'::jsonb,
  retry_count integer not null default 0,
  next_retry_at timestamptz not null default now(),
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_onchain_failed_events
  add column if not exists contract_event_id text,
  add column if not exists tx_hash text,
  add column if not exists chain_id integer not null default 56,
  add column if not exists block_number bigint,
  add column if not exists log_index integer,
  add column if not exists error text,
  add column if not exists raw_event jsonb not null default '{}'::jsonb,
  add column if not exists retry_count integer not null default 0,
  add column if not exists next_retry_at timestamptz not null default now(),
  add column if not exists status text not null default 'pending',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_daily_income_caps (
  user_id uuid not null references hb_users(id) on delete cascade,
  cap_date date not null,
  package_amount numeric(20, 8) not null default 0,
  daily_cap_amount numeric(20, 8) not null default 0,
  credited_amount numeric(20, 8) not null default 0,
  capped_amount numeric(20, 8) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, cap_date)
);

alter table hb_daily_income_caps
  add column if not exists package_amount numeric(20, 8) not null default 0,
  add column if not exists daily_cap_amount numeric(20, 8) not null default 0,
  add column if not exists credited_amount numeric(20, 8) not null default 0,
  add column if not exists capped_amount numeric(20, 8) not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table hb_income_ledger
  add column if not exists cap_status text,
  add column if not exists capped_amount numeric(20, 8) not null default 0,
  add column if not exists credited_amount numeric(20, 8),
  add column if not exists cap_date date,
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

alter table hb_income_ledger drop constraint if exists hb_income_ledger_cap_status_check;
alter table hb_income_ledger
  add constraint hb_income_ledger_cap_status_check
  check (cap_status is null or cap_status in ('within_cap', 'partially_capped', 'capped'));

alter table hb_income_ledger drop constraint if exists hb_income_ledger_income_type_check;
alter table hb_income_ledger
  add constraint hb_income_ledger_income_type_check
  check (income_type in ('upline', 'level', 'referral_income', 'level_income', 'salary_income', 'single_leg_income', 'admin_income', 'single_leg', 'product_value', 'recharge_credit', 'company'));

create table if not exists hb_salary_income (
  user_id uuid primary key references hb_users(id) on delete cascade,
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

alter table hb_salary_income drop constraint if exists hb_salary_income_status_check;
alter table hb_salary_income
  add constraint hb_salary_income_status_check
  check (status in ('locked', 'unlocked', 'paid'));

create table if not exists hb_single_leg_positions (
  user_id uuid primary key references hb_users(id) on delete cascade,
  position_number bigint not null unique,
  sponsor_user_id uuid references hb_users(id),
  package_amount numeric(20, 8) not null default 0,
  activated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table hb_single_leg_positions
  add column if not exists position_number bigint,
  add column if not exists sponsor_user_id uuid references hb_users(id),
  add column if not exists package_amount numeric(20, 8) not null default 0,
  add column if not exists activated_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

create table if not exists hb_single_leg_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  slab_number integer not null,
  target_members bigint not null,
  reward_amount numeric(20, 8) not null,
  required_direct_referrals integer not null,
  actual_single_leg_members bigint not null default 0,
  actual_direct_referrals integer not null default 0,
  status text not null default 'locked',
  paid_at timestamptz,
  ledger_reference uuid,
  proof_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slab_number)
);

alter table hb_single_leg_rewards
  add column if not exists user_id uuid references hb_users(id) on delete cascade,
  add column if not exists slab_number integer,
  add column if not exists target_members bigint,
  add column if not exists reward_amount numeric(20, 8),
  add column if not exists required_direct_referrals integer,
  add column if not exists actual_single_leg_members bigint not null default 0,
  add column if not exists actual_direct_referrals integer not null default 0,
  add column if not exists status text not null default 'locked',
  add column if not exists paid_at timestamptz,
  add column if not exists ledger_reference uuid,
  add column if not exists proof_reference text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table hb_single_leg_rewards drop constraint if exists hb_single_leg_rewards_status_check;
alter table hb_single_leg_rewards
  add constraint hb_single_leg_rewards_status_check
  check (status in ('locked', 'qualified', 'paid'));

create table if not exists hb_single_leg_reserve (
  id uuid primary key default gen_random_uuid(),
  package_purchase_id uuid not null unique references hb_package_purchases(id),
  buyer_user_id uuid not null references hb_users(id),
  package_id uuid not null references hb_packages(id),
  amount_usd numeric(20, 8) not null,
  status text not null default 'reserved',
  ledger_entry_id uuid references hb_income_ledger(id),
  algorithm_version text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table hb_single_leg_reserve
  add column if not exists package_purchase_id uuid references hb_package_purchases(id),
  add column if not exists buyer_user_id uuid references hb_users(id),
  add column if not exists package_id uuid references hb_packages(id),
  add column if not exists amount_usd numeric(20, 8),
  add column if not exists status text not null default 'reserved',
  add column if not exists ledger_entry_id uuid references hb_income_ledger(id),
  add column if not exists algorithm_version text not null default 'pending',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

create table if not exists hb_ledger_proofs (
  id uuid primary key default gen_random_uuid(),
  public_reference_id text not null unique,
  source_table text not null,
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

alter table hb_ledger_proofs
  add column if not exists public_reference_id text,
  add column if not exists source_table text,
  add column if not exists ledger_entry_id uuid,
  add column if not exists user_id uuid references hb_users(id),
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

alter table hb_ledger_proofs drop constraint if exists hb_ledger_proofs_source_table_check;
alter table hb_ledger_proofs
  add constraint hb_ledger_proofs_source_table_check
  check (source_table in ('hb_internal_ledger', 'hb_income_ledger', 'hb_coin_balance_ledger'));

create index if not exists idx_hb_coin_ledger_user_created on hb_coin_balance_ledger (user_id, created_at desc);
create index if not exists idx_hb_users_hb9_wallet_address on hb_users (hb9_wallet_address);
create unique index if not exists idx_hb_users_hb9_wallet_lower_unique on hb_users (lower(hb9_wallet_address)) where hb9_wallet_address is not null;
create index if not exists idx_hb_coin_ledger_symbol_created on hb_coin_balance_ledger (coin_symbol, created_at desc);
create index if not exists idx_hb_coin_balance_ledger_proof_hash on hb_coin_balance_ledger (proof_hash);
create index if not exists idx_hb_withdrawals_user_created_repair on hb_withdrawals (user_id, requested_at desc);
create index if not exists idx_hb_package_purchases_user_created_repair on hb_package_purchases (user_id, created_at desc);
create index if not exists idx_hb_package_purchases_contract_event on hb_package_purchases (contract_event_id) where contract_event_id is not null;
create index if not exists idx_hb_package_purchases_tx on hb_package_purchases (contract_purchase_tx_hash) where contract_purchase_tx_hash is not null;
create index if not exists idx_hb_package_purchases_act_tx on hb_package_purchases (act_purchase_tx_hash) where act_purchase_tx_hash is not null;
create unique index if not exists idx_hb_onchain_purchase_event_id on hb_onchain_purchase_events (contract_event_id) where contract_event_id is not null;
create unique index if not exists idx_hb_onchain_purchase_event_log on hb_onchain_purchase_events (chain_id, tx_hash, log_index) where log_index is not null;
create index if not exists idx_hb_onchain_purchase_buyer on hb_onchain_purchase_events (buyer_user_id, created_at desc);
create index if not exists idx_hb_onchain_purchase_status on hb_onchain_purchase_events (status, created_at desc);
create index if not exists idx_hb_onchain_failed_retry on hb_onchain_failed_events (status, next_retry_at);
create index if not exists idx_hb_onchain_sync_logs_status on hb_onchain_sync_logs (contract_key, status, created_at);
create index if not exists idx_hb_daily_income_caps_date on hb_daily_income_caps (cap_date desc, capped_amount desc);
create index if not exists idx_hb_income_ledger_cap_date on hb_income_ledger (cap_date desc, earner_user_id) where cap_date is not null;
create index if not exists idx_hb_income_ledger_capped on hb_income_ledger (cap_status, created_at desc) where cap_status in ('partially_capped', 'capped');
create index if not exists idx_hb_income_referral_level_created on hb_income_ledger (earner_user_id, income_type, created_at desc) where income_type in ('referral_income', 'level_income');
create index if not exists idx_hb_salary_income_status on hb_salary_income (status, updated_at desc);
create unique index if not exists idx_hb_salary_income_paid_once on hb_income_ledger (earner_user_id) where income_type = 'salary_income' and status = 'credited';
create unique index if not exists idx_hb_single_leg_positions_position_unique on hb_single_leg_positions (position_number) where position_number is not null;
create index if not exists idx_hb_single_leg_rewards_status on hb_single_leg_rewards (status, updated_at desc);
create index if not exists idx_hb_single_leg_rewards_user on hb_single_leg_rewards (user_id, slab_number);
create unique index if not exists idx_hb_single_leg_income_once on hb_income_ledger (earner_user_id, ((metadata->>'slabNumber')::integer)) where income_type = 'single_leg_income' and status = 'credited';
create index if not exists idx_hb_single_leg_reserve_buyer_created on hb_single_leg_reserve (buyer_user_id, created_at desc);
create index if not exists idx_hb_ledger_proofs_hash on hb_ledger_proofs (proof_hash);
create index if not exists idx_hb_ledger_proofs_previous_hash on hb_ledger_proofs (previous_proof_hash);
create index if not exists idx_hb_ledger_proofs_public_ref on hb_ledger_proofs (public_reference_id);
create index if not exists idx_hb_ledger_proofs_user_created on hb_ledger_proofs (user_id, created_at desc);
create index if not exists idx_hb_ledger_proofs_chain_tx on hb_ledger_proofs (chain_tx_hash) where chain_tx_hash is not null;
