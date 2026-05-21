update hb_income_ledger
set income_type = 'referral_income',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('legacyIncomeType', 'upline')
where income_type = 'upline';

update hb_income_ledger
set income_type = 'level_income',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('legacyIncomeType', 'level')
where income_type = 'level';

alter table hb_income_ledger
  drop constraint if exists hb_income_ledger_income_type_check,
  add constraint hb_income_ledger_income_type_check
    check (income_type in ('referral_income', 'level_income', 'single_leg', 'product_value', 'recharge_credit', 'company'));

create index if not exists idx_hb_income_referral_level_created
  on hb_income_ledger (earner_user_id, income_type, created_at desc)
  where income_type in ('referral_income', 'level_income');

insert into hb_internal_ledger
  (user_id, wallet_type, direction, amount_usd, reference_type, reference_id, idempotency_key, metadata, created_at)
select earner_user_id,
       'deposit',
       'credit',
       amount_usd,
       income_type,
       id,
       'hb:wallet:' || income_type || ':' || id::text,
       jsonb_build_object('sourceUserId', source_user_id, 'packagePurchaseId', package_purchase_id, 'levelDepth', level_depth, 'backfill', true),
       created_at
from hb_income_ledger
where income_type in ('referral_income', 'level_income')
  and status = 'credited'
  and earner_user_id is not null
on conflict (idempotency_key) do nothing;
