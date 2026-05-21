alter table hb_users
  alter column password_hash drop not null;

alter table hb_wallet_auth_challenges
  add column if not exists chain_id integer,
  add column if not exists domain text,
  add column if not exists sponsor_referral_code text;

create index if not exists idx_hb_wallet_auth_wallet_created
  on hb_wallet_auth_challenges (lower(wallet_address), created_at desc);

create unique index if not exists idx_hb_users_usdt_bep20_lower_unique
  on hb_users (lower(usdt_bep20_address))
  where usdt_bep20_address is not null;

create unique index if not exists idx_hb_users_hb9_wallet_lower_unique
  on hb_users (lower(hb9_wallet_address))
  where hb9_wallet_address is not null;
