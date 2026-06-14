alter table hb_coin_balances drop constraint if exists hb_coin_balances_coin_symbol_check;
update hb_coin_balances set coin_symbol = 'BTTC' where coin_symbol = 'BTCT';
delete from hb_coin_balances where coin_symbol = 'ETH';
alter table hb_coin_balances
  add constraint hb_coin_balances_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_coin_balances
  alter column balance type numeric(38, 18);

alter table hb_coin_balance_ledger drop constraint if exists hb_coin_balance_ledger_coin_symbol_check;
update hb_coin_balance_ledger set coin_symbol = 'BTTC' where coin_symbol = 'BTCT';
delete from hb_coin_balance_ledger where coin_symbol = 'ETH';
alter table hb_coin_balance_ledger
  add constraint hb_coin_balance_ledger_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_coin_balance_ledger drop constraint if exists hb_coin_balance_ledger_type_check;
alter table hb_coin_balance_ledger
  add constraint hb_coin_balance_ledger_type_check
  check (type in ('credit', 'debit', 'earning', 'withdrawal', 'admin', 'manual', 'admin_credit', 'admin_debit', 'convert_debit', 'convert_credit', 'convert_credit_usdt', 'convert_credit_hb9'));

alter table hb_coin_balance_ledger
  alter column amount type numeric(38, 18),
  add column if not exists usd_price numeric(28, 12),
  add column if not exists usd_value numeric(28, 8),
  add column if not exists reference_id text;

create table if not exists hb_coin_conversions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  from_coin text not null check (from_coin in ('BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA')),
  from_amount numeric(38, 18) not null check (from_amount > 0),
  usd_price numeric(28, 12) not null default 0,
  usd_value numeric(28, 8) not null default 0 check (usd_value >= 0),
  credited_usdt numeric(28, 8) not null default 0 check (credited_usdt >= 0),
  from_usd_value numeric(28, 8) not null default 0 check (from_usd_value >= 0),
  usdt_credit_amount numeric(28, 8) not null default 0 check (usdt_credit_amount >= 0),
  hb9_credit_amount numeric(38, 18) not null default 0 check (hb9_credit_amount >= 0),
  hb9_price_used numeric(28, 12) not null default 0.90,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  proof_reference text,
  proof_reference_id text,
  debit_ledger_entry_id uuid references hb_coin_balance_ledger(id),
  credit_ledger_entry_id uuid references hb_coin_balance_ledger(id),
  usdt_credit_ledger_entry_id uuid references hb_coin_balance_ledger(id),
  hb9_credit_ledger_entry_id uuid references hb_coin_balance_ledger(id),
  internal_ledger_entry_id uuid references hb_internal_ledger(id),
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_hb_coin_conversions_user_created on hb_coin_conversions (user_id, created_at desc);
create index if not exists idx_hb_coin_conversions_coin_created on hb_coin_conversions (from_coin, created_at desc);

alter table hb_internal_transfers drop constraint if exists hb_internal_transfers_coin_symbol_check;
update hb_internal_transfers set coin_symbol = 'BTTC' where coin_symbol = 'BTCT';
delete from hb_internal_transfers where coin_symbol = 'ETH';
alter table hb_internal_transfers
  add constraint hb_internal_transfers_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_admin_balance_actions drop constraint if exists hb_admin_balance_actions_coin_symbol_check;
update hb_admin_balance_actions set coin_symbol = 'BTTC' where coin_symbol = 'BTCT';
delete from hb_admin_balance_actions where coin_symbol = 'ETH';
alter table hb_admin_balance_actions
  add constraint hb_admin_balance_actions_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));
