create extension if not exists pgcrypto;

create table if not exists hb_users (
  id uuid primary key default gen_random_uuid(),
  email text,
  mobile_number text,
  password_hash text,
  display_name text,
  referral_code text,
  sponsor_user_id uuid,
  status text not null default 'inactive',
  usdt_bep20_address text,
  hb9_wallet_address text,
  wallet_bound_at timestamptz,
  wallet_updated_at timestamptz,
  failed_login_count integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_users
  add column if not exists email text,
  add column if not exists mobile_number text,
  add column if not exists password_hash text,
  add column if not exists display_name text,
  add column if not exists referral_code text,
  add column if not exists sponsor_user_id uuid,
  add column if not exists status text not null default 'inactive',
  add column if not exists usdt_bep20_address text,
  add column if not exists hb9_wallet_address text,
  add column if not exists wallet_bound_at timestamptz,
  add column if not exists wallet_updated_at timestamptz,
  add column if not exists failed_login_count integer not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  network text not null default 'bsc',
  wallet_address text,
  wallet_type text not null default 'deposit',
  is_primary boolean not null default true,
  created_at timestamptz not null default now()
);

alter table hb_wallets
  add column if not exists user_id uuid,
  add column if not exists network text not null default 'bsc',
  add column if not exists wallet_address text,
  add column if not exists wallet_type text not null default 'deposit',
  add column if not exists is_primary boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

create table if not exists hb_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount_usd numeric(20, 8) not null default 0,
  status text not null default 'available',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_packages
  add column if not exists name text,
  add column if not exists amount_usd numeric(20, 8) not null default 0,
  add column if not exists status text not null default 'available',
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_products (
  id uuid primary key default gen_random_uuid(),
  package_id uuid,
  title text not null,
  slug text,
  description text,
  image_url text,
  package_price numeric(20, 8) not null default 0,
  delivery_type text,
  stock integer not null default 0,
  active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_products
  add column if not exists package_id uuid,
  add column if not exists title text,
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists image_url text,
  add column if not exists package_price numeric(20, 8) not null default 0,
  add column if not exists delivery_type text,
  add column if not exists stock integer not null default 0,
  add column if not exists active boolean not null default true,
  add column if not exists featured boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid,
  image_url text,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table hb_product_images
  add column if not exists product_id uuid,
  add column if not exists image_url text,
  add column if not exists alt_text text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now();

create table if not exists hb_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  network text not null default 'bsc',
  asset text not null default 'USDT',
  amount numeric(20, 8) not null default 0,
  usd_amount numeric(20, 8) not null default 0,
  tx_hash text,
  wallet_address text,
  status text not null default 'pending',
  verification_status text,
  failure_reason text,
  provider text,
  payment_id text,
  pay_address text,
  pay_currency text,
  price_amount numeric(20, 8),
  pay_amount numeric(20, 8),
  payment_status text,
  payment_invoice_url text,
  signature_valid boolean,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_deposits
  add column if not exists user_id uuid,
  add column if not exists network text not null default 'bsc',
  add column if not exists asset text not null default 'USDT',
  add column if not exists amount numeric(20, 8) not null default 0,
  add column if not exists usd_amount numeric(20, 8) not null default 0,
  add column if not exists tx_hash text,
  add column if not exists wallet_address text,
  add column if not exists status text not null default 'pending',
  add column if not exists verification_status text,
  add column if not exists failure_reason text,
  add column if not exists provider text,
  add column if not exists payment_id text,
  add column if not exists pay_address text,
  add column if not exists pay_currency text,
  add column if not exists price_amount numeric(20, 8),
  add column if not exists pay_amount numeric(20, 8),
  add column if not exists payment_status text,
  add column if not exists payment_invoice_url text,
  add column if not exists signature_valid boolean,
  add column if not exists verified_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

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

create table if not exists hb_referrals (
  id uuid primary key default gen_random_uuid(),
  sponsor_user_id uuid,
  referred_user_id uuid,
  level_depth integer not null default 1,
  created_at timestamptz not null default now()
);

alter table hb_referrals
  add column if not exists sponsor_user_id uuid,
  add column if not exists referred_user_id uuid,
  add column if not exists level_depth integer not null default 1,
  add column if not exists created_at timestamptz not null default now();

create table if not exists hb_onchain_contracts (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  chain_id integer not null default 56,
  contract_address text,
  start_block bigint,
  enabled boolean not null default false,
  label text,
  updated_at timestamptz not null default now()
);

alter table hb_onchain_contracts
  add column if not exists key text,
  add column if not exists chain_id integer not null default 56,
  add column if not exists contract_address text,
  add column if not exists start_block bigint,
  add column if not exists enabled boolean not null default false,
  add column if not exists label text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_onchain_purchase_events (
  id uuid primary key default gen_random_uuid(),
  contract_event_id text,
  tx_hash text,
  chain_id integer not null default 56,
  contract_address text,
  block_number bigint,
  log_index integer,
  onchain_package_id integer,
  buyer_address text,
  sponsor_address text,
  referral_code text,
  amount_usd numeric(20, 8),
  buyer_user_id uuid,
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
  add column if not exists buyer_address text,
  add column if not exists sponsor_address text,
  add column if not exists referral_code text,
  add column if not exists amount_usd numeric(20, 8),
  add column if not exists buyer_user_id uuid,
  add column if not exists status text not null default 'submitted',
  add column if not exists raw_event jsonb not null default '{}'::jsonb,
  add column if not exists synced_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_financial_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table hb_financial_settings
  add column if not exists value text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_coin_conversions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  from_coin text,
  to_coin text,
  from_amount numeric(20, 8) not null default 0,
  to_amount numeric(20, 8),
  rate numeric(20, 8),
  usd_price numeric(20, 8),
  usd_value numeric(20, 8),
  credited_usdt numeric(20, 8),
  from_usd_value numeric(20, 8),
  usdt_credit_amount numeric(20, 8),
  hb9_credit_amount numeric(20, 8),
  hb9_price_used numeric(20, 8),
  status text not null default 'pending',
  idempotency_key text,
  proof_reference_id text,
  proof_reference text,
  debit_ledger_entry_id uuid,
  credit_ledger_entry_id uuid,
  usdt_credit_ledger_entry_id uuid,
  hb9_credit_ledger_entry_id uuid,
  internal_ledger_entry_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_coin_conversions
  add column if not exists user_id uuid,
  add column if not exists from_coin text,
  add column if not exists to_coin text,
  add column if not exists from_amount numeric(20, 8) not null default 0,
  add column if not exists to_amount numeric(20, 8),
  add column if not exists rate numeric(20, 8),
  add column if not exists usd_price numeric(20, 8),
  add column if not exists usd_value numeric(20, 8),
  add column if not exists credited_usdt numeric(20, 8),
  add column if not exists from_usd_value numeric(20, 8),
  add column if not exists usdt_credit_amount numeric(20, 8),
  add column if not exists hb9_credit_amount numeric(20, 8),
  add column if not exists hb9_price_used numeric(20, 8),
  add column if not exists status text not null default 'pending',
  add column if not exists idempotency_key text,
  add column if not exists proof_reference_id text,
  add column if not exists proof_reference text,
  add column if not exists debit_ledger_entry_id uuid,
  add column if not exists credit_ledger_entry_id uuid,
  add column if not exists usdt_credit_ledger_entry_id uuid,
  add column if not exists hb9_credit_ledger_entry_id uuid,
  add column if not exists internal_ledger_entry_id uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_withdrawal_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  min_withdrawal_usd numeric(20, 8) not null default 0,
  fee_percent numeric(10, 4) not null default 0,
  daily_limit_usd numeric(20, 8) not null default 0,
  cooldown_minutes integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_withdrawal_limits
  add column if not exists user_id uuid,
  add column if not exists min_withdrawal_usd numeric(20, 8) not null default 0,
  add column if not exists fee_percent numeric(10, 4) not null default 0,
  add column if not exists daily_limit_usd numeric(20, 8) not null default 0,
  add column if not exists cooldown_minutes integer not null default 0,
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_production_controls (
  key text primary key,
  value text not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table hb_production_controls
  add column if not exists value text,
  add column if not exists updated_by text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_treasury_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  wallet_address text,
  network text not null default 'bsc',
  chain_id integer not null default 56,
  label text not null default 'HB9 treasury wallet',
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_treasury_settings
  add column if not exists key text,
  add column if not exists wallet_address text,
  add column if not exists network text not null default 'bsc',
  add column if not exists chain_id integer not null default 56,
  add column if not exists label text not null default 'HB9 treasury wallet',
  add column if not exists updated_by text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_risk_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  flag text,
  reason text,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_risk_flags
  add column if not exists user_id uuid,
  add column if not exists flag text,
  add column if not exists reason text,
  add column if not exists active boolean not null default true,
  add column if not exists created_by text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_activation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  package_purchase_id uuid,
  previous_status text,
  new_status text,
  created_at timestamptz not null default now()
);

alter table hb_activation_logs
  add column if not exists user_id uuid,
  add column if not exists package_purchase_id uuid,
  add column if not exists previous_status text,
  add column if not exists new_status text,
  add column if not exists created_at timestamptz not null default now();

create table if not exists hb_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table hb_audit_logs
  add column if not exists user_id uuid,
  add column if not exists action text,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

create table if not exists hb_followers_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  package_purchase_id uuid,
  package_id uuid,
  status text not null default 'pending',
  admin_remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_followers_requests
  add column if not exists user_id uuid,
  add column if not exists package_purchase_id uuid,
  add column if not exists package_id uuid,
  add column if not exists status text not null default 'pending',
  add column if not exists admin_remark text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_custom_software_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  package_purchase_id uuid,
  status text not null default 'pending',
  admin_remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_custom_software_requests
  add column if not exists user_id uuid,
  add column if not exists package_purchase_id uuid,
  add column if not exists status text not null default 'pending',
  add column if not exists admin_remark text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_product_library (
  id uuid primary key default gen_random_uuid(),
  title text,
  category text,
  description text,
  file_url text,
  cover_image text,
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table hb_product_library
  add column if not exists title text,
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists file_url text,
  add column if not exists cover_image text,
  add column if not exists status text not null default 'active',
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists idx_hb_users_referral_code_contract on hb_users (referral_code) where referral_code is not null;
create unique index if not exists idx_hb_wallets_user_type_network_contract on hb_wallets (user_id, wallet_type, network);
create unique index if not exists idx_hb_products_slug_contract on hb_products (slug) where slug is not null;
create unique index if not exists idx_hb_referrals_referred_user_contract on hb_referrals (referred_user_id);
create unique index if not exists idx_hb_onchain_contracts_key_contract on hb_onchain_contracts (key);
create unique index if not exists idx_hb_onchain_purchase_events_contract_event_id_contract on hb_onchain_purchase_events (contract_event_id);
create unique index if not exists idx_hb_onchain_purchase_events_log_contract on hb_onchain_purchase_events (chain_id, tx_hash, log_index) where log_index is not null;
create unique index if not exists idx_hb_treasury_settings_key_contract on hb_treasury_settings (key);
create unique index if not exists idx_hb_coin_conversions_idempotency_contract on hb_coin_conversions (idempotency_key);
create index if not exists idx_hb_deposits_user_created_contract on hb_deposits (user_id, created_at desc);
create index if not exists idx_hb_wallets_user_contract on hb_wallets (user_id, created_at desc);
create index if not exists idx_hb_referrals_sponsor_contract on hb_referrals (sponsor_user_id, created_at desc);
create index if not exists idx_hb_coin_conversions_user_created_contract on hb_coin_conversions (user_id, created_at desc);
