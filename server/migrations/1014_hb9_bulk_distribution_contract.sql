alter table hb_coin_balances drop constraint if exists hb_coin_balances_coin_symbol_check;
alter table hb_coin_balances
  add constraint hb_coin_balances_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_coin_balance_ledger drop constraint if exists hb_coin_balance_ledger_coin_symbol_check;
alter table hb_coin_balance_ledger
  add constraint hb_coin_balance_ledger_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_coin_balance_ledger drop constraint if exists hb_coin_balance_ledger_type_check;
alter table hb_coin_balance_ledger
  add constraint hb_coin_balance_ledger_type_check
  check (type in (
    'credit', 'debit', 'earning', 'withdrawal', 'admin', 'manual',
    'admin_credit', 'admin_debit', 'convert_debit', 'convert_credit',
    'convert_credit_usdt', 'convert_credit_hb9',
    'deposit_credit', 'withdrawal_debit', 'withdrawal_fee'
  ));

alter table hb_admin_balance_actions drop constraint if exists hb_admin_balance_actions_coin_symbol_check;
alter table hb_admin_balance_actions
  add constraint hb_admin_balance_actions_coin_symbol_check
  check (coin_symbol in ('USDT', 'BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));

alter table hb_admin_balance_actions drop constraint if exists hb_admin_balance_actions_type_check;
alter table hb_admin_balance_actions
  add constraint hb_admin_balance_actions_type_check
  check (type in ('credit', 'deduct', 'bulk_distribution'));
