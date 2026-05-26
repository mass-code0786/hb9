alter table hb_coin_balances drop constraint if exists hb_coin_balances_coin_symbol_check;
alter table hb_coin_balances
  add constraint hb_coin_balances_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_coin_balance_ledger drop constraint if exists hb_coin_balance_ledger_coin_symbol_check;
alter table hb_coin_balance_ledger
  add constraint hb_coin_balance_ledger_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_internal_transfers drop constraint if exists hb_internal_transfers_coin_symbol_check;
alter table hb_internal_transfers
  add constraint hb_internal_transfers_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_admin_balance_actions drop constraint if exists hb_admin_balance_actions_coin_symbol_check;
alter table hb_admin_balance_actions
  add constraint hb_admin_balance_actions_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_coin_conversions drop constraint if exists hb_coin_conversions_from_coin_check;
alter table hb_coin_conversions
  add constraint hb_coin_conversions_from_coin_check
  check (from_coin in ('BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));
