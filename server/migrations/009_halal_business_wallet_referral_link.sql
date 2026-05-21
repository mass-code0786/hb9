alter table hb_users
  add column if not exists hb9_wallet_address text,
  add column if not exists sponsor_referral_code text,
  add column if not exists own_referral_code text,
  add column if not exists source_referral_code text;

update hb_users
set own_referral_code = referral_code
where own_referral_code is null;

create index if not exists idx_hb_users_hb9_wallet_address on hb_users (hb9_wallet_address);
create index if not exists idx_hb_users_source_referral_code on hb_users (source_referral_code);
