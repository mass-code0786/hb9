create table if not exists hb_distribution_runs (
  id uuid primary key default gen_random_uuid(),
  package_purchase_id uuid not null unique references hb_package_purchases(id),
  user_id uuid not null references hb_users(id),
  package_id uuid not null references hb_packages(id),
  amount_usd numeric(20, 8) not null,
  status text not null default 'completed' check (status in ('completed', 'failed', 'reversed')),
  created_at timestamptz not null default now()
);

create table if not exists hb_product_allocations (
  id uuid primary key default gen_random_uuid(),
  package_purchase_id uuid not null unique references hb_package_purchases(id),
  user_id uuid not null references hb_users(id),
  package_id uuid not null references hb_packages(id),
  amount_usd numeric(20, 8) not null,
  status text not null default 'allocated' check (status in ('allocated', 'reversed')),
  ledger_entry_id uuid references hb_income_ledger(id),
  created_at timestamptz not null default now()
);

create table if not exists hb_level_income_records (
  id uuid primary key default gen_random_uuid(),
  package_purchase_id uuid not null references hb_package_purchases(id),
  buyer_user_id uuid not null references hb_users(id),
  receiver_user_id uuid references hb_users(id),
  package_id uuid not null references hb_packages(id),
  level_number integer not null check (level_number between 1 and 15),
  amount_usd numeric(20, 8) not null,
  status text not null check (status in ('credited', 'company_reserved')),
  ledger_entry_id uuid references hb_income_ledger(id),
  created_at timestamptz not null default now(),
  unique (package_purchase_id, level_number)
);

create table if not exists hb_single_leg_reserve (
  id uuid primary key default gen_random_uuid(),
  package_purchase_id uuid not null unique references hb_package_purchases(id),
  buyer_user_id uuid not null references hb_users(id),
  package_id uuid not null references hb_packages(id),
  amount_usd numeric(20, 8) not null,
  status text not null default 'reserved' check (status in ('reserved', 'released', 'reversed')),
  ledger_entry_id uuid references hb_income_ledger(id),
  algorithm_version text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table hb_income_ledger
  drop constraint if exists hb_income_ledger_income_type_check,
  add constraint hb_income_ledger_income_type_check
    check (income_type in ('upline', 'level', 'single_leg', 'product_value', 'recharge_credit', 'company'));

create unique index if not exists idx_hb_income_purchase_type_unique
  on hb_income_ledger (package_purchase_id, income_type, coalesce(level_depth, 0), coalesce(earner_user_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists idx_hb_level_income_receiver_created on hb_level_income_records (receiver_user_id, created_at desc);
create index if not exists idx_hb_product_allocations_user_created on hb_product_allocations (user_id, created_at desc);
create index if not exists idx_hb_single_leg_reserve_buyer_created on hb_single_leg_reserve (buyer_user_id, created_at desc);
