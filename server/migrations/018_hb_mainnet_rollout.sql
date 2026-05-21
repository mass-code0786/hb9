create table if not exists hb_production_controls (
  key text primary key,
  value text not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into hb_production_controls (key, value)
values
  ('rollout_mode', 'closed_beta'),
  ('emergency_pause', 'false'),
  ('emergency_indexer_stop', 'false'),
  ('emergency_activation_disable', 'false'),
  ('emergency_withdrawal_freeze', 'false'),
  ('emergency_treasury_freeze_notice', 'false'),
  ('rollback_mode', 'false'),
  ('daily_activation_limit', '25'),
  ('maintenance_notice', ''),
  ('launch_banner', 'Controlled mainnet rollout in progress.'),
  ('warning_banner', 'Limited live access: package activation is monitored and rate limited.')
on conflict (key) do nothing;

create table if not exists hb_rollout_whitelist (
  id uuid primary key default gen_random_uuid(),
  wallet_address text,
  referral_code text,
  label text,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  unique (wallet_address),
  unique (referral_code)
);

create index if not exists idx_hb_rollout_whitelist_wallet on hb_rollout_whitelist (lower(wallet_address)) where wallet_address is not null;
create index if not exists idx_hb_rollout_whitelist_referral on hb_rollout_whitelist (upper(referral_code)) where referral_code is not null;

create table if not exists hb_mainnet_readiness (
  key text primary key,
  confirmed boolean not null default false,
  note text,
  confirmed_by text,
  confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into hb_mainnet_readiness (key, confirmed)
values
  ('multisig_active', false),
  ('treasury_funded', false),
  ('rpc_healthy', false),
  ('indexer_healthy', false),
  ('contracts_verified', false),
  ('audit_completed', false),
  ('explorer_links_working', false),
  ('rollback_plan_ready', false)
on conflict (key) do nothing;
