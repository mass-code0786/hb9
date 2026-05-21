alter table recharge_orders
  add column if not exists chain_id integer,
  add column if not exists token_symbol text,
  add column if not exists token_contract text,
  add column if not exists from_address text,
  add column if not exists to_address text,
  add column if not exists verified_amount numeric(36, 18),
  add column if not exists confirmations integer,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verification_error text;

alter table payment_orders
  add column if not exists chain_id integer,
  add column if not exists token_symbol text,
  add column if not exists token_contract text,
  add column if not exists from_address text,
  add column if not exists to_address text,
  add column if not exists verified_amount numeric(36, 18),
  add column if not exists confirmations integer,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verification_error text;

create unique index if not exists idx_recharge_orders_tx_hash_unique
  on recharge_orders (lower(tx_hash))
  where tx_hash is not null;

create unique index if not exists idx_payment_orders_tx_hash_unique
  on payment_orders (lower(tx_hash))
  where tx_hash is not null;
