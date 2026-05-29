alter table hb_income_ledger
  drop constraint if exists hb_income_ledger_income_type_check,
  add constraint hb_income_ledger_income_type_check
    check (income_type in (
      'upline',
      'level',
      'referral_income',
      'level_income',
      'salary_income',
      'single_leg_income',
      'dividend_income',
      'admin_income',
      'single_leg',
      'product_value',
      'recharge_credit',
      'company'
    ));
