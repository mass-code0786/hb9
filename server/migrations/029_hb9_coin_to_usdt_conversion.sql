alter table hb_coin_conversions drop constraint if exists hb_coin_conversions_from_coin_check;
alter table hb_coin_conversions
  add constraint hb_coin_conversions_from_coin_check
  check (from_coin in ('BTC', 'BNB', 'HB9', 'PEPE', 'DOGE', 'SHIB', 'BTTC', 'ADA'));
