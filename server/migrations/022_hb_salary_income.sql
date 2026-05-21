create table if not exists hb_salary_income (
  user_id uuid primary key references hb_users(id) on delete cascade,
  salary_amount numeric(20, 8) not null default 100,
  status text not null default 'locked' check (status in ('locked', 'unlocked', 'paid')),
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

alter table hb_income_ledger
  drop constraint if exists hb_income_ledger_income_type_check,
  add constraint hb_income_ledger_income_type_check
    check (income_type in ('referral_income', 'level_income', 'salary_income', 'single_leg', 'product_value', 'recharge_credit', 'company'));

create unique index if not exists idx_hb_salary_income_paid_once
  on hb_income_ledger (earner_user_id)
  where income_type = 'salary_income' and status = 'credited';

create index if not exists idx_hb_salary_income_status
  on hb_salary_income (status, updated_at desc);
