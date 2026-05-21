alter table hb_deposits
  add column if not exists credited_at timestamptz;

alter table hb_withdrawals
  add column if not exists gross_amount numeric(20, 8),
  add column if not exists fee_amount numeric(20, 8),
  add column if not exists net_amount numeric(20, 8);

update hb_withdrawals
set gross_amount = coalesce(gross_amount, amount_usd),
    fee_amount = coalesce(fee_amount, fee_usd),
    net_amount = coalesce(net_amount, payout_amount_usd)
where gross_amount is null or fee_amount is null or net_amount is null;

alter table hb_coin_balance_ledger drop constraint if exists hb_coin_balance_ledger_type_check;
alter table hb_coin_balance_ledger
  add constraint hb_coin_balance_ledger_type_check
  check (type in (
    'credit', 'debit', 'earning', 'withdrawal', 'admin', 'manual',
    'admin_credit', 'admin_debit', 'convert_debit', 'convert_credit',
    'convert_credit_usdt', 'convert_credit_hb9',
    'deposit_credit', 'withdrawal_debit', 'withdrawal_fee'
  ));

update hb_financial_settings
set value = '2', updated_at = now()
where key = 'withdrawal_min_usd';

update hb_financial_settings
set value = '0', updated_at = now()
where key = 'withdrawal_cooldown_minutes';

update hb_financial_settings
set value = 'false', updated_at = now()
where key in ('withdrawal_require_active_id', 'withdrawal_require_package');
