alter table hb_users
  add column if not exists wallet_address text,
  add column if not exists activation_fee_paid boolean not null default false,
  add column if not exists activation_fee_tx_hash text;

update hb_users
set wallet_address = coalesce(wallet_address, usdt_bep20_address, hb9_wallet_address)
where wallet_address is null;

update hb_users
set activation_fee_paid = true
where status = 'active'
  and activation_fee_paid = false;

create index if not exists idx_hb_users_wallet_address
  on hb_users (wallet_address);

create unique index if not exists idx_hb_users_wallet_address_lower_unique
  on hb_users (lower(wallet_address))
  where wallet_address is not null;
