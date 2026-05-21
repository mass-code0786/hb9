alter table hb_deposits
  drop constraint if exists hb_deposits_status_check,
  add constraint hb_deposits_status_check check (status in ('pending', 'verified', 'rejected', 'failed'));

alter table hb_deposits
  drop constraint if exists hb_deposits_verification_status_check,
  add constraint hb_deposits_verification_status_check check (verification_status in ('pending', 'verified', 'rejected', 'failed'));

alter table hb_deposits
  add column if not exists idempotency_key text,
  add column if not exists ledger_entry_id uuid references hb_internal_ledger(id);

alter table hb_package_purchases
  add column if not exists ledger_entry_id uuid references hb_internal_ledger(id);

create unique index if not exists idx_hb_deposits_idempotency_unique
  on hb_deposits (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists idx_hb_deposit_credit_once
  on hb_internal_ledger (reference_id)
  where reference_type = 'deposit' and direction = 'credit';

create unique index if not exists idx_hb_purchase_debit_once
  on hb_internal_ledger (reference_id)
  where reference_type = 'package_purchase' and direction = 'debit';
