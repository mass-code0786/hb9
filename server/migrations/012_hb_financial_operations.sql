alter table hb_withdrawals
  drop constraint if exists hb_withdrawals_status_check,
  add constraint hb_withdrawals_status_check
    check (status in ('pending', 'under_review', 'approved', 'processing', 'paid', 'rejected', 'cancelled', 'failed'));

alter table hb_withdrawals
  add column if not exists fee_usd numeric(20, 8) not null default 0,
  add column if not exists payout_amount_usd numeric(20, 8) not null default 0,
  add column if not exists reviewed_at timestamptz,
  add column if not exists processing_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists idempotency_key text;

update hb_withdrawals
set payout_amount_usd = amount_usd - fee_usd
where payout_amount_usd = 0;

create unique index if not exists idx_hb_withdrawals_idempotency
  on hb_withdrawals (idempotency_key)
  where idempotency_key is not null;

create table if not exists hb_financial_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into hb_financial_settings (key, value, description)
values
  ('withdrawal_min_usd', '2', 'Minimum user withdrawal amount in USD'),
  ('withdrawal_fee_percent', '10', 'Withdrawal fee percentage'),
  ('withdrawal_daily_limit_usd', '500', 'Maximum user withdrawal amount per rolling 24 hours'),
  ('withdrawal_cooldown_minutes', '10', 'Minimum time between withdrawal requests'),
  ('withdrawal_require_active_id', 'true', 'Require active ID before withdrawal'),
  ('withdrawal_require_package', 'true', 'Require completed package purchase before withdrawal')
on conflict (key) do nothing;

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

create unique index if not exists idx_hb_withdrawal_limits_user_active
  on hb_withdrawal_limits (user_id)
  where active = true;

create table if not exists hb_risk_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  flag text not null check (flag in ('normal', 'review', 'suspended', 'withdrawal_blocked')),
  reason text,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_hb_risk_flags_user_active on hb_risk_flags (user_id, active);

create table if not exists hb_reconciliation_logs (
  id uuid primary key default gen_random_uuid(),
  check_type text not null,
  status text not null check (status in ('ok', 'mismatch', 'warning')),
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
  created_at timestamptz not null default now()
);

create index if not exists idx_hb_reconciliation_logs_created on hb_reconciliation_logs (created_at desc);
create index if not exists idx_hb_admin_action_logs_entity on hb_admin_action_logs (entity_type, entity_id, created_at desc);
