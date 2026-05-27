create table if not exists hb_dividend_income_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id),
  source_action_id uuid null,
  coin_symbol text not null,
  coin_amount numeric(38,18) not null default 0,
  usd_value numeric(38,18) not null default 0,
  package_total_usd numeric(38,18) not null default 0,
  cap_usd numeric(38,18) not null default 0,
  credited_usd numeric(38,18) not null default 0,
  status text not null default 'credited',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_hb_dividend_income_ledger_user_id on hb_dividend_income_ledger (user_id);
create index if not exists idx_hb_dividend_income_ledger_coin_symbol on hb_dividend_income_ledger (coin_symbol);
create index if not exists idx_hb_dividend_income_ledger_created_at on hb_dividend_income_ledger (created_at);
