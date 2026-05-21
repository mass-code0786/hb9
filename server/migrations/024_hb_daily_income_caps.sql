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

alter table hb_income_ledger
  add column if not exists cap_status text,
  add column if not exists capped_amount numeric(20, 8) not null default 0,
  add column if not exists credited_amount numeric(20, 8),
  add column if not exists cap_date date;

alter table hb_income_ledger
  drop constraint if exists hb_income_ledger_cap_status_check,
  add constraint hb_income_ledger_cap_status_check
    check (cap_status is null or cap_status in ('within_cap', 'partially_capped', 'capped'));

alter table hb_income_ledger
  drop constraint if exists hb_income_ledger_income_type_check,
  add constraint hb_income_ledger_income_type_check
    check (income_type in ('referral_income', 'level_income', 'salary_income', 'single_leg_income', 'admin_income', 'single_leg', 'product_value', 'recharge_credit', 'company'));

create index if not exists idx_hb_daily_income_caps_date
  on hb_daily_income_caps (cap_date desc, capped_amount desc);

create index if not exists idx_hb_income_ledger_cap_date
  on hb_income_ledger (cap_date desc, earner_user_id)
  where cap_date is not null;

create index if not exists idx_hb_income_ledger_capped
  on hb_income_ledger (cap_status, created_at desc)
  where cap_status in ('partially_capped', 'capped');
