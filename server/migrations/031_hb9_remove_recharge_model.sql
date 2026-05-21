comment on column hb_internal_ledger.wallet_type is
  'HB9 active wallet types are deposit and income. recharge is legacy and must not receive new HB9 package distribution credits.';

comment on table recharge_orders is
  'Legacy BitzenX recharge orders. This table is not connected to active HB9 package distribution.';

comment on table hb_product_allocations is
  'Legacy HB9 product allocation records. Final HB9 package split no longer creates product allocation treasury records.';

comment on table hb_single_leg_reserve is
  'Legacy HB9 single-leg reserve records. Final HB9 package split no longer creates single-leg package reserve records.';

comment on column hb_income_ledger.income_type is
  'Active HB9 package distribution uses referral_income, level_income, and company treasury hold. product_value and recharge_credit are legacy values.';
