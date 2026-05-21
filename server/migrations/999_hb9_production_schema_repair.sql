-- Complete idempotent HB9 production schema sync.
-- deploy/scripts/migrate.sh reapplies this repair even if schema_migrations
-- already recorded it, so VPS drift is corrected on every deploy.

create extension if not exists pgcrypto;

create table if not exists hb_users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  mobile_number text,
  password_hash text,
  display_name text not null default 'HB9 User',
  referral_code text not null unique,
  own_referral_code text,
  sponsor_user_id uuid references hb_users(id),
  sponsor_referral_code text,
  source_referral_code text,
  status text not null default 'inactive',
  activated_at timestamptz,
  usdt_bep20_address text,
  hb9_wallet_address text,
  wallet_bound_at timestamptz,
  wallet_updated_at timestamptz,
  last_login_at timestamptz,
  failed_login_count integer not null default 0,
  locked_until timestamptz,
  password_changed_at timestamptz,
  reset_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_users
  add column if not exists email text,
  add column if not exists mobile_number text,
  add column if not exists password_hash text,
  add column if not exists display_name text not null default 'HB9 User',
  add column if not exists referral_code text,
  add column if not exists own_referral_code text,
  add column if not exists sponsor_user_id uuid references hb_users(id),
  add column if not exists sponsor_referral_code text,
  add column if not exists source_referral_code text,
  add column if not exists status text not null default 'inactive',
  add column if not exists activated_at timestamptz,
  add column if not exists usdt_bep20_address text,
  add column if not exists hb9_wallet_address text,
  add column if not exists wallet_bound_at timestamptz,
  add column if not exists wallet_updated_at timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists failed_login_count integer not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists password_changed_at timestamptz,
  add column if not exists reset_required boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table hb_users alter column email drop not null;
alter table hb_users alter column password_hash drop not null;
alter table hb_users drop constraint if exists hb_users_status_check;
alter table hb_users
  add constraint hb_users_status_check
  check (status in ('inactive', 'active', 'suspended', 'blocked'));

create table if not exists hb_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id),
  network text not null default 'bsc',
  wallet_address text,
  wallet_type text not null default 'deposit',
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, wallet_type, network)
);

alter table hb_wallets
  add column if not exists user_id uuid references hb_users(id),
  add column if not exists network text not null default 'bsc',
  add column if not exists wallet_address text,
  add column if not exists wallet_type text not null default 'deposit',
  add column if not exists is_primary boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

alter table hb_wallets drop constraint if exists hb_wallets_wallet_type_check;
alter table hb_wallets
  add constraint hb_wallets_wallet_type_check
  check (wallet_type in ('deposit', 'income', 'recharge'));

create table if not exists hb_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  amount_usd numeric(20, 8) not null unique,
  status text not null default 'available',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_packages
  add column if not exists description text,
  add column if not exists image_url text,
  add column if not exists status text not null default 'available',
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table hb_packages drop constraint if exists hb_packages_status_check;
alter table hb_packages
  add constraint hb_packages_status_check
  check (status in ('available', 'disabled'));

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

create table if not exists hb_referrals (
  id uuid primary key default gen_random_uuid(),
  sponsor_user_id uuid not null references hb_users(id),
  referred_user_id uuid not null unique references hb_users(id),
  level_depth integer not null default 1,
  created_at timestamptz not null default now()
);

alter table hb_referrals
  add column if not exists sponsor_user_id uuid references hb_users(id),
  add column if not exists referred_user_id uuid references hb_users(id),
  add column if not exists level_depth integer not null default 1,
  add column if not exists created_at timestamptz not null default now();

create table if not exists hb_internal_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references hb_users(id),
  wallet_type text not null default 'deposit',
  direction text not null,
  amount_usd numeric(20, 8) not null,
  reference_type text not null,
  reference_id uuid,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  proof_hash text,
  previous_proof_hash text,
  proof_payload_json jsonb,
  proof_created_at timestamptz,
  public_reference_id text,
  chain_id integer,
  contract_address text,
  onchain_tx_hash text,
  onchain_status text not null default 'not_applicable',
  onchain_synced_at timestamptz,
  payout_mode text not null default 'internal',
  treasury_wallet_address text,
  multisig_reference text,
  created_at timestamptz not null default now()
);

alter table hb_internal_ledger
  add column if not exists user_id uuid references hb_users(id),
  add column if not exists wallet_type text not null default 'deposit',
  add column if not exists direction text,
  add column if not exists amount_usd numeric(20, 8),
  add column if not exists reference_type text,
  add column if not exists reference_id uuid,
  add column if not exists idempotency_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
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
  add column if not exists multisig_reference text,
  add column if not exists created_at timestamptz not null default now();

alter table hb_internal_ledger drop constraint if exists hb_internal_ledger_wallet_type_check;
alter table hb_internal_ledger
  add constraint hb_internal_ledger_wallet_type_check
  check (wallet_type in ('deposit', 'income', 'recharge', 'company'));

alter table hb_internal_ledger drop constraint if exists hb_internal_ledger_direction_check;
alter table hb_internal_ledger
  add constraint hb_internal_ledger_direction_check
  check (direction in ('credit', 'debit'));

create table if not exists hb_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id),
  wallet_address text,
  network text not null default 'bsc',
  asset text not null default 'USDT',
  amount numeric(36, 18) not null default 0,
  usd_amount numeric(20, 8) not null default 0,
  tx_hash text,
  status text not null default 'pending',
  verification_status text not null default 'pending',
  chain_id integer,
  from_address text,
  to_address text,
  confirmations integer,
  verified_at timestamptz,
  credited_at timestamptz,
  failure_reason text,
  ledger_entry_id uuid references hb_internal_ledger(id),
  provider text not null default 'manual',
  payment_id text,
  pay_address text,
  pay_currency text,
  price_amount numeric(20, 8),
  pay_amount numeric(36, 18),
  payment_status text,
  payment_order_id text,
  payment_purchase_id text,
  payment_invoice_url text,
  payment_raw jsonb not null default '{}'::jsonb,
  public_reference_id text,
  contract_address text,
  onchain_tx_hash text,
  onchain_status text not null default 'not_applicable',
  onchain_synced_at timestamptz,
  treasury_wallet_address text,
  multisig_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_deposits
  add column if not exists user_id uuid references hb_users(id),
  add column if not exists wallet_address text,
  add column if not exists network text not null default 'bsc',
  add column if not exists asset text not null default 'USDT',
  add column if not exists amount numeric(36, 18) not null default 0,
  add column if not exists usd_amount numeric(20, 8) not null default 0,
  add column if not exists tx_hash text,
  add column if not exists status text not null default 'pending',
  add column if not exists verification_status text not null default 'pending',
  add column if not exists chain_id integer,
  add column if not exists from_address text,
  add column if not exists to_address text,
  add column if not exists confirmations integer,
  add column if not exists verified_at timestamptz,
  add column if not exists credited_at timestamptz,
  add column if not exists failure_reason text,
  add column if not exists ledger_entry_id uuid references hb_internal_ledger(id),
  add column if not exists provider text not null default 'manual',
  add column if not exists payment_id text,
  add column if not exists pay_address text,
  add column if not exists pay_currency text,
  add column if not exists price_amount numeric(20, 8),
  add column if not exists pay_amount numeric(36, 18),
  add column if not exists payment_status text,
  add column if not exists payment_order_id text,
  add column if not exists payment_purchase_id text,
  add column if not exists payment_invoice_url text,
  add column if not exists payment_raw jsonb not null default '{}'::jsonb,
  add column if not exists public_reference_id text,
  add column if not exists contract_address text,
  add column if not exists onchain_tx_hash text,
  add column if not exists onchain_status text not null default 'not_applicable',
  add column if not exists onchain_synced_at timestamptz,
  add column if not exists treasury_wallet_address text,
  add column if not exists multisig_reference text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table hb_deposits drop constraint if exists hb_deposits_status_check;
alter table hb_deposits
  add constraint hb_deposits_status_check
  check (status in ('pending', 'verified', 'rejected', 'failed'));

alter table hb_deposits drop constraint if exists hb_deposits_verification_status_check;
alter table hb_deposits
  add constraint hb_deposits_verification_status_check
  check (verification_status in ('pending', 'verified', 'rejected', 'failed'));

create table if not exists hb_package_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id),
  package_id uuid not null references hb_packages(id),
  amount_usd numeric(20, 8) not null,
  status text not null default 'completed',
  idempotency_key text not null unique,
  ledger_entry_id uuid references hb_internal_ledger(id),
  contract_purchase_tx_hash text,
  act_purchase_tx_hash text,
  contract_event_id text,
  block_number bigint,
  log_index integer,
  onchain_package_id integer,
  onchain_buyer_address text,
  onchain_sponsor_address text,
  onchain_status text not null default 'not_applicable',
  synced_at timestamptz,
  public_reference_id text,
  chain_id integer,
  contract_address text,
  onchain_tx_hash text,
  onchain_synced_at timestamptz,
  payout_mode text not null default 'internal',
  treasury_wallet_address text,
  multisig_reference text,
  created_at timestamptz not null default now()
);

alter table hb_package_purchases
  add column if not exists user_id uuid references hb_users(id),
  add column if not exists package_id uuid references hb_packages(id),
  add column if not exists amount_usd numeric(20, 8),
  add column if not exists status text not null default 'completed',
  add column if not exists idempotency_key text,
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
  add column if not exists multisig_reference text,
  add column if not exists created_at timestamptz not null default now();

alter table hb_package_purchases drop constraint if exists hb_package_purchases_status_check;
alter table hb_package_purchases
  add constraint hb_package_purchases_status_check
  check (status in ('pending', 'completed', 'failed', 'reversed'));

update hb_package_purchases
set act_purchase_tx_hash = coalesce(act_purchase_tx_hash, contract_purchase_tx_hash, onchain_tx_hash)
where act_purchase_tx_hash is null;

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
  income_type text not null,
  amount_usd numeric(20, 8) not null,
  status text not null default 'pending',
  level_depth integer,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  credited_amount numeric(20, 8),
  capped_amount numeric(20, 8) not null default 0,
  cap_status text,
  cap_date date,
  proof_hash text,
  previous_proof_hash text,
  proof_payload_json jsonb,
  proof_created_at timestamptz,
  public_reference_id text,
  chain_id integer,
  contract_address text,
  onchain_tx_hash text,
  onchain_status text not null default 'not_applicable',
  onchain_synced_at timestamptz,
  payout_mode text not null default 'internal',
  treasury_wallet_address text,
  multisig_reference text,
  created_at timestamptz not null default now()
);

alter table hb_income_ledger
  add column if not exists earner_user_id uuid references hb_users(id),
  add column if not exists source_user_id uuid references hb_users(id),
  add column if not exists package_purchase_id uuid references hb_package_purchases(id),
  add column if not exists income_type text,
  add column if not exists amount_usd numeric(20, 8),
  add column if not exists status text not null default 'pending',
  add column if not exists level_depth integer,
  add column if not exists idempotency_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists credited_amount numeric(20, 8),
  add column if not exists capped_amount numeric(20, 8) not null default 0,
  add column if not exists cap_status text,
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
  add column if not exists multisig_reference text,
  add column if not exists created_at timestamptz not null default now();

alter table hb_income_ledger drop constraint if exists hb_income_ledger_status_check;
alter table hb_income_ledger
  add constraint hb_income_ledger_status_check
  check (status in ('pending', 'credited', 'locked', 'company_allocated', 'failed', 'cancelled'));

create table if not exists hb_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references hb_users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists hb_distribution_runs (
  id uuid primary key default gen_random_uuid(),
  package_purchase_id uuid not null unique references hb_package_purchases(id),
  user_id uuid not null references hb_users(id),
  package_id uuid not null references hb_packages(id),
  amount_usd numeric(20, 8) not null,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table if not exists hb_product_allocations (
  id uuid primary key default gen_random_uuid(),
  package_purchase_id uuid not null unique references hb_package_purchases(id),
  user_id uuid not null references hb_users(id),
  package_id uuid not null references hb_packages(id),
  amount_usd numeric(20, 8) not null,
  status text not null default 'allocated',
  ledger_entry_id uuid references hb_income_ledger(id),
  created_at timestamptz not null default now()
);

create table if not exists hb_level_income_records (
  id uuid primary key default gen_random_uuid(),
  package_purchase_id uuid not null references hb_package_purchases(id),
  buyer_user_id uuid not null references hb_users(id),
  receiver_user_id uuid references hb_users(id),
  package_id uuid not null references hb_packages(id),
  level_number integer not null,
  amount_usd numeric(20, 8) not null,
  status text not null default 'credited',
  ledger_entry_id uuid references hb_income_ledger(id),
  created_at timestamptz not null default now(),
  unique (package_purchase_id, level_number)
);

alter table hb_level_income_records drop constraint if exists hb_level_income_records_status_check;
alter table hb_level_income_records
  add constraint hb_level_income_records_status_check
  check (status in ('credited', 'company_reserved', 'locked'));

create table if not exists hb_admin_notes (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  entity_type text not null,
  entity_id uuid,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists hb_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  token_jti text not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text,
  ip_address text,
  created_at timestamptz not null default now()
);

create table if not exists hb_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  token_hash text not null unique,
  delivery_target text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists hb_wallet_auth_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references hb_users(id),
  wallet_address text not null,
  nonce text not null unique,
  message text not null,
  signature text,
  status text not null default 'pending',
  chain_id integer,
  domain text,
  sponsor_referral_code text,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table hb_wallet_auth_challenges
  add column if not exists chain_id integer,
  add column if not exists domain text,
  add column if not exists sponsor_referral_code text,
  add column if not exists signature text,
  add column if not exists status text not null default 'pending',
  add column if not exists verified_at timestamptz;

alter table hb_wallet_auth_challenges drop constraint if exists hb_wallet_auth_challenges_status_check;
alter table hb_wallet_auth_challenges
  add constraint hb_wallet_auth_challenges_status_check
  check (status in ('pending', 'verified', 'expired', 'rejected'));

create table if not exists hb_deposit_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'nowpayments',
  payment_id text,
  deposit_id uuid references hb_deposits(id),
  signature text,
  signature_valid boolean not null default false,
  payment_status text,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processing_error text,
  created_at timestamptz not null default now()
);

create table if not exists hb_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id),
  wallet_type text not null default 'deposit',
  amount_usd numeric(20, 8) not null,
  gross_amount numeric(20, 8),
  fee_usd numeric(20, 8) not null default 0,
  fee_amount numeric(20, 8),
  payout_amount_usd numeric(20, 8) not null default 0,
  net_amount numeric(20, 8),
  currency text not null default 'USDT',
  network text not null default 'bsc',
  wallet_address text not null,
  status text not null default 'pending',
  reserve_ledger_entry_id uuid references hb_internal_ledger(id),
  refund_ledger_entry_id uuid references hb_internal_ledger(id),
  paid_ledger_entry_id uuid references hb_internal_ledger(id),
  tx_hash text,
  failure_reason text,
  admin_note text,
  idempotency_key text,
  public_reference_id text,
  chain_id integer,
  contract_address text,
  onchain_tx_hash text,
  onchain_status text not null default 'not_applicable',
  onchain_synced_at timestamptz,
  payout_mode text not null default 'internal',
  treasury_wallet_address text,
  multisig_reference text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  processing_at timestamptz,
  paid_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table hb_withdrawals
  add column if not exists user_id uuid references hb_users(id),
  add column if not exists wallet_type text not null default 'deposit',
  add column if not exists amount_usd numeric(20, 8),
  add column if not exists gross_amount numeric(20, 8),
  add column if not exists fee_usd numeric(20, 8) not null default 0,
  add column if not exists fee_amount numeric(20, 8),
  add column if not exists payout_amount_usd numeric(20, 8) not null default 0,
  add column if not exists net_amount numeric(20, 8),
  add column if not exists currency text not null default 'USDT',
  add column if not exists network text not null default 'bsc',
  add column if not exists wallet_address text,
  add column if not exists status text not null default 'pending',
  add column if not exists reserve_ledger_entry_id uuid references hb_internal_ledger(id),
  add column if not exists refund_ledger_entry_id uuid references hb_internal_ledger(id),
  add column if not exists paid_ledger_entry_id uuid references hb_internal_ledger(id),
  add column if not exists tx_hash text,
  add column if not exists failure_reason text,
  add column if not exists admin_note text,
  add column if not exists idempotency_key text,
  add column if not exists public_reference_id text,
  add column if not exists chain_id integer,
  add column if not exists contract_address text,
  add column if not exists onchain_tx_hash text,
  add column if not exists onchain_status text not null default 'not_applicable',
  add column if not exists onchain_synced_at timestamptz,
  add column if not exists payout_mode text not null default 'internal',
  add column if not exists treasury_wallet_address text,
  add column if not exists multisig_reference text,
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists processing_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table hb_withdrawals drop constraint if exists hb_withdrawals_status_check;
alter table hb_withdrawals
  add constraint hb_withdrawals_status_check
  check (status in ('pending', 'under_review', 'approved', 'processing', 'paid', 'rejected', 'cancelled', 'failed'));

alter table hb_withdrawals drop constraint if exists hb_withdrawals_wallet_type_check;
alter table hb_withdrawals
  add constraint hb_withdrawals_wallet_type_check
  check (wallet_type in ('deposit', 'income'));

update hb_withdrawals
set gross_amount = coalesce(gross_amount, amount_usd),
    fee_amount = coalesce(fee_amount, fee_usd),
    net_amount = coalesce(net_amount, payout_amount_usd)
where gross_amount is null or fee_amount is null or net_amount is null;

create table if not exists hb_withdrawal_audit_logs (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid references hb_withdrawals(id),
  user_id uuid references hb_users(id),
  admin_email text,
  action text not null,
  previous_status text,
  next_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists hb_product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists hb_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  short_description text,
  package_id uuid references hb_packages(id),
  package_price numeric(20, 8) not null default 0,
  package_type text not null default 'activation',
  image_url text,
  thumbnail_url text,
  stock integer not null default 0,
  active boolean not null default true,
  featured boolean not null default false,
  category_id uuid references hb_product_categories(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hb_products
  add column if not exists short_description text,
  add column if not exists thumbnail_url text,
  add column if not exists stock integer not null default 0,
  add column if not exists active boolean not null default true,
  add column if not exists featured boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists hb_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references hb_products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists hb_product_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references hb_users(id),
  package_purchase_id uuid references hb_package_purchases(id),
  order_number text,
  amount_usd numeric(20, 8) not null default 0,
  payment_status text not null default 'paid',
  activation_status text not null default 'completed',
  distribution_status text not null default 'completed',
  contract_purchase_tx_hash text,
  act_purchase_tx_hash text,
  contract_event_id text,
  block_number bigint,
  log_index integer,
  onchain_package_id integer,
  onchain_buyer_address text,
  onchain_sponsor_address text,
  onchain_status text not null default 'not_applicable',
  synced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table hb_product_orders
  add column if not exists order_number text,
  add column if not exists payment_status text not null default 'paid',
  add column if not exists activation_status text not null default 'completed',
  add column if not exists distribution_status text not null default 'completed',
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

create table if not exists hb_product_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references hb_product_orders(id) on delete cascade,
  product_id uuid not null references hb_products(id),
  package_id uuid not null references hb_packages(id),
  title text not null,
  package_price numeric(20, 8) not null,
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists hb_product_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  description text,
  file_url text not null,
  cover_image text,
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists hb_user_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  package_purchase_id uuid references hb_package_purchases(id) on delete cascade,
  package_id uuid references hb_packages(id),
  package_name text not null,
  package_amount numeric(20, 8) not null,
  status text not null default 'active',
  activated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (package_purchase_id)
);

alter table hb_user_products
  add column if not exists package_amount numeric(20, 8) not null default 0;

create table if not exists hb_book_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  book_id uuid not null references hb_product_library(id) on delete cascade,
  package_purchase_id uuid references hb_package_purchases(id),
  downloaded_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create table if not exists hb_followers_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  package_id uuid references hb_packages(id),
  package_purchase_id uuid references hb_package_purchases(id),
  platform text not null,
  submitted_link text not null,
  followers_count integer not null default 0,
  status text not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists hb_software_access (
  id uuid primary key default gen_random_uuid(),
  package_amount numeric(20, 8) not null,
  software_key text not null,
  title text not null,
  description text,
  access_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (package_amount, software_key)
);

create table if not exists hb_custom_software_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  package_purchase_id uuid references hb_package_purchases(id),
  software_type text not null,
  architecture text not null,
  requirements_note text not null,
  status text not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists hb_financial_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists hb_withdrawal_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references hb_users(id) on delete cascade,
  min_withdrawal_usd numeric(20, 8),
  fee_percent numeric(10, 4),
  daily_limit_usd numeric(20, 8),
  cooldown_minutes integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_risk_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  flag text not null,
  reason text,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table hb_risk_flags drop constraint if exists hb_risk_flags_flag_check;
alter table hb_risk_flags
  add constraint hb_risk_flags_flag_check
  check (flag in ('normal', 'review', 'suspended', 'withdrawal_blocked'));

create table if not exists hb_reconciliation_logs (
  id uuid primary key default gen_random_uuid(),
  check_type text not null,
  status text not null,
  entity_type text,
  entity_id uuid,
  expected_amount numeric(20, 8),
  actual_amount numeric(20, 8),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists hb_admin_action_logs (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  previous_status text,
  next_status text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  proof_reference text,
  created_at timestamptz not null default now()
);

alter table hb_admin_action_logs
  add column if not exists ip_address text,
  add column if not exists before_snapshot jsonb,
  add column if not exists after_snapshot jsonb,
  add column if not exists proof_reference text;

create table if not exists hb_admin_operation_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  ip_address text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  proof_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists hb_risk_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references hb_users(id) on delete cascade,
  wallet_address text,
  risk_score integer not null,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists hb_governance_settings (
  key text primary key,
  value text,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists hb_production_controls (
  key text primary key,
  value text not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists hb_rollout_whitelist (
  id uuid primary key default gen_random_uuid(),
  wallet_address text,
  referral_code text,
  label text,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists hb_mainnet_readiness (
  key text primary key,
  confirmed boolean not null default false,
  note text,
  confirmed_by text,
  confirmed_at timestamptz,
  updated_at timestamptz not null default now()
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

alter table hb_treasury_settings
  add column if not exists wallet_address text,
  add column if not exists network text not null default 'bsc',
  add column if not exists chain_id integer not null default 56,
  add column if not exists label text not null default 'HB9 treasury wallet',
  add column if not exists updated_by text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

insert into hb_treasury_settings (key, label)
values
  ('treasury_usdt_bep20_address', 'Treasury USDT BEP20 address'),
  ('payout_wallet_address', 'Payout wallet address'),
  ('company_reserve_wallet', 'Company reserve wallet'),
  ('product_allocation_wallet', 'Product allocation wallet'),
  ('single_leg_reserve_wallet', 'Single-leg reserve wallet')
on conflict (key) do nothing;

create table if not exists hb_coin_conversions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  from_coin text not null,
  from_amount numeric(38, 18) not null,
  usd_price numeric(28, 12) not null default 0,
  usd_value numeric(28, 8) not null default 0,
  credited_usdt numeric(28, 8) not null default 0,
  from_usd_value numeric(28, 8) not null default 0,
  usdt_credit_amount numeric(28, 8) not null default 0,
  hb9_credit_amount numeric(38, 18) not null default 0,
  hb9_price_used numeric(28, 12) not null default 0.13,
  status text not null default 'completed',
  proof_reference text,
  proof_reference_id text,
  debit_ledger_entry_id uuid,
  credit_ledger_entry_id uuid,
  usdt_credit_ledger_entry_id uuid,
  hb9_credit_ledger_entry_id uuid,
  internal_ledger_entry_id uuid references hb_internal_ledger(id),
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

alter table hb_coin_conversions
  add column if not exists from_usd_value numeric(28, 8) not null default 0,
  add column if not exists usdt_credit_amount numeric(28, 8) not null default 0,
  add column if not exists hb9_credit_amount numeric(38, 18) not null default 0,
  add column if not exists hb9_price_used numeric(28, 12) not null default 0.13,
  add column if not exists proof_reference text,
  add column if not exists proof_reference_id text,
  add column if not exists debit_ledger_entry_id uuid,
  add column if not exists credit_ledger_entry_id uuid,
  add column if not exists usdt_credit_ledger_entry_id uuid,
  add column if not exists hb9_credit_ledger_entry_id uuid,
  add column if not exists internal_ledger_entry_id uuid references hb_internal_ledger(id),
  add column if not exists idempotency_key text,
  add column if not exists created_at timestamptz not null default now();

alter table hb_coin_conversions drop constraint if exists hb_coin_conversions_from_coin_check;
delete from hb_coin_conversions where from_coin = 'ETH';
alter table hb_coin_conversions
  add constraint hb_coin_conversions_from_coin_check
  check (from_coin in ('BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_coin_conversions drop constraint if exists hb_coin_conversions_status_check;
alter table hb_coin_conversions
  add constraint hb_coin_conversions_status_check
  check (status in ('completed', 'failed'));

create table if not exists hb_internal_transfers (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references hb_users(id),
  receiver_user_id uuid not null references hb_users(id),
  coin_symbol text not null,
  amount numeric(38, 18) not null,
  type text not null default 'admin_transfer',
  note text not null,
  admin_id text not null,
  sender_ledger_entry_id uuid,
  receiver_ledger_entry_id uuid,
  proof_reference text,
  sender_before_balance numeric(38, 18) not null default 0,
  sender_after_balance numeric(38, 18) not null default 0,
  receiver_before_balance numeric(38, 18) not null default 0,
  receiver_after_balance numeric(38, 18) not null default 0,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

alter table hb_internal_transfers
  add column if not exists proof_reference text,
  add column if not exists sender_before_balance numeric(38, 18) not null default 0,
  add column if not exists sender_after_balance numeric(38, 18) not null default 0,
  add column if not exists receiver_before_balance numeric(38, 18) not null default 0,
  add column if not exists receiver_after_balance numeric(38, 18) not null default 0;

alter table hb_internal_transfers drop constraint if exists hb_internal_transfers_coin_symbol_check;
delete from hb_internal_transfers where coin_symbol = 'ETH';
update hb_internal_transfers set coin_symbol = 'BTTC' where coin_symbol = 'BTCT';
alter table hb_internal_transfers
  add constraint hb_internal_transfers_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

create table if not exists hb_admin_balance_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id),
  coin_symbol text not null,
  amount numeric(38, 18) not null,
  type text not null,
  note text not null,
  admin_id text not null,
  ledger_entry_id uuid,
  proof_reference text,
  before_balance numeric(38, 18) not null default 0,
  after_balance numeric(38, 18) not null default 0,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

alter table hb_admin_balance_actions
  add column if not exists proof_reference text,
  add column if not exists before_balance numeric(38, 18) not null default 0,
  add column if not exists after_balance numeric(38, 18) not null default 0;

alter table hb_admin_balance_actions drop constraint if exists hb_admin_balance_actions_coin_symbol_check;
delete from hb_admin_balance_actions where coin_symbol = 'ETH';
update hb_admin_balance_actions set coin_symbol = 'BTTC' where coin_symbol = 'BTCT';
alter table hb_admin_balance_actions
  add constraint hb_admin_balance_actions_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_admin_balance_actions drop constraint if exists hb_admin_balance_actions_type_check;
alter table hb_admin_balance_actions
  add constraint hb_admin_balance_actions_type_check
  check (type in ('credit', 'deduct', 'bulk_distribution'));

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
