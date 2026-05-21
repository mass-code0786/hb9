create unique index if not exists idx_hb_withdrawals_tx_hash_unique
  on hb_withdrawals (lower(tx_hash))
  where tx_hash is not null and tx_hash <> '';

create unique index if not exists idx_hb_withdrawals_onchain_tx_hash_unique
  on hb_withdrawals (lower(onchain_tx_hash))
  where onchain_tx_hash is not null and onchain_tx_hash <> '';

create or replace view hb9_coin_balances as
select *
from hb_coin_balances;

insert into hb_financial_settings (key, value)
values
  ('withdrawal_min_usd', '2'),
  ('withdrawal_fee_percent', '10'),
  ('withdrawal_cooldown_minutes', '5')
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

insert into hb_production_controls (key, value)
values
  ('emergency_deposit_freeze', 'false'),
  ('emergency_package_purchase_pause', 'false'),
  ('emergency_coin_conversion_disable', 'false'),
  ('emergency_follower_request_disable', 'false')
on conflict (key) do nothing;
