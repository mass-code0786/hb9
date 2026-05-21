create table if not exists hb_single_leg_positions (
  user_id uuid primary key references hb_users(id) on delete cascade,
  position_number bigint not null unique,
  sponsor_user_id uuid references hb_users(id),
  package_amount numeric(20, 8) not null,
  activated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists hb_single_leg_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  slab_number integer not null check (slab_number between 1 and 9),
  target_members bigint not null,
  reward_amount numeric(20, 8) not null,
  required_direct_referrals integer not null,
  actual_single_leg_members bigint not null default 0,
  actual_direct_referrals integer not null default 0,
  status text not null default 'locked' check (status in ('locked', 'qualified', 'paid')),
  paid_at timestamptz,
  ledger_reference uuid,
  proof_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slab_number)
);

alter table hb_income_ledger
  drop constraint if exists hb_income_ledger_income_type_check,
  add constraint hb_income_ledger_income_type_check
    check (income_type in ('referral_income', 'level_income', 'salary_income', 'single_leg_income', 'single_leg', 'product_value', 'recharge_credit', 'company'));

create unique index if not exists idx_hb_single_leg_income_once
  on hb_income_ledger (earner_user_id, ((metadata->>'slabNumber')::integer))
  where income_type = 'single_leg_income' and status = 'credited';

create index if not exists idx_hb_single_leg_positions_position
  on hb_single_leg_positions (position_number);

create index if not exists idx_hb_single_leg_rewards_status
  on hb_single_leg_rewards (status, updated_at desc);

create index if not exists idx_hb_single_leg_rewards_user
  on hb_single_leg_rewards (user_id, slab_number);

insert into hb_single_leg_positions (user_id, position_number, sponsor_user_id, package_amount, activated_at, created_at)
select user_id,
       (select coalesce(max(position_number), 0) from hb_single_leg_positions)
         + row_number() over (order by first_eligible_at asc, user_id asc),
       sponsor_user_id,
       package_amount,
       first_eligible_at,
       first_eligible_at
from (
  select distinct on (p.user_id)
         p.user_id,
         u.sponsor_user_id,
         p.amount_usd as package_amount,
         p.created_at as first_eligible_at
  from hb_package_purchases p
  join hb_users u on u.id = p.user_id
  where p.status = 'completed'
    and p.amount_usd >= 20
  order by p.user_id, p.created_at asc
) eligible
on conflict (user_id) do nothing;
