alter table hb_coin_balances drop constraint if exists hb_coin_balances_coin_symbol_check;
delete from hb_coin_balances where coin_symbol = 'ETH';
alter table hb_coin_balances
  add constraint hb_coin_balances_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_coin_balance_ledger drop constraint if exists hb_coin_balance_ledger_coin_symbol_check;
delete from hb_coin_balance_ledger where coin_symbol = 'ETH';
alter table hb_coin_balance_ledger
  add constraint hb_coin_balance_ledger_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_coin_conversions drop constraint if exists hb_coin_conversions_from_coin_check;
delete from hb_coin_conversions where from_coin = 'ETH';
alter table hb_coin_conversions
  add column if not exists from_usd_value numeric(28, 8) not null default 0,
  add column if not exists usdt_credit_amount numeric(28, 8) not null default 0,
  add column if not exists hb9_credit_amount numeric(38, 18) not null default 0,
  add column if not exists hb9_price_used numeric(28, 12) not null default 0.13,
  add column if not exists proof_reference text,
  add column if not exists usdt_credit_ledger_entry_id uuid references hb_coin_balance_ledger(id),
  add column if not exists hb9_credit_ledger_entry_id uuid references hb_coin_balance_ledger(id);
update hb_coin_conversions
set from_usd_value = coalesce(nullif(from_usd_value, 0), usd_value),
    usdt_credit_amount = coalesce(nullif(usdt_credit_amount, 0), credited_usdt),
    hb9_price_used = coalesce(nullif(hb9_price_used, 0), 0.13),
    proof_reference = coalesce(proof_reference, proof_reference_id),
    usdt_credit_ledger_entry_id = coalesce(usdt_credit_ledger_entry_id, credit_ledger_entry_id);
alter table hb_coin_conversions
  add constraint hb_coin_conversions_from_coin_check
  check (from_coin in ('BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_coin_balance_ledger drop constraint if exists hb_coin_balance_ledger_type_check;
alter table hb_coin_balance_ledger
  add constraint hb_coin_balance_ledger_type_check
  check (type in (
    'credit', 'debit', 'earning', 'withdrawal', 'admin', 'manual',
    'admin_credit', 'admin_debit', 'convert_debit', 'convert_credit',
    'convert_credit_usdt', 'convert_credit_hb9',
    'deposit_credit', 'withdrawal_debit', 'withdrawal_fee'
  ));

alter table hb_internal_transfers drop constraint if exists hb_internal_transfers_coin_symbol_check;
delete from hb_internal_transfers where coin_symbol = 'ETH';
alter table hb_internal_transfers
  add constraint hb_internal_transfers_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_admin_balance_actions drop constraint if exists hb_admin_balance_actions_coin_symbol_check;
delete from hb_admin_balance_actions where coin_symbol = 'ETH';
alter table hb_admin_balance_actions
  add constraint hb_admin_balance_actions_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));
