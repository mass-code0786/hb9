create table if not exists hb_coin_balances (
  user_id uuid not null references hb_users(id) on delete cascade,
  coin_symbol text not null check (coin_symbol in ('USDT', 'ADA', 'DOGE', 'SHIB', 'PEPE', 'BTCT')),
  balance numeric(28, 8) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, coin_symbol)
);

create table if not exists hb_coin_balance_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  coin_symbol text not null check (coin_symbol in ('USDT', 'ADA', 'DOGE', 'SHIB', 'PEPE', 'BTCT')),
  amount numeric(28, 8) not null check (amount > 0),
  type text not null check (type in ('credit', 'debit', 'earning', 'withdrawal', 'admin', 'manual')),
  direction text not null check (direction in ('credit', 'debit')),
  reference text,
  admin_id text,
  note text,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_hb_coin_ledger_user_created on hb_coin_balance_ledger (user_id, created_at desc);
create index if not exists idx_hb_coin_ledger_symbol_created on hb_coin_balance_ledger (coin_symbol, created_at desc);
