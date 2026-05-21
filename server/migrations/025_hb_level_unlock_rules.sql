alter table hb_income_ledger
  drop constraint if exists hb_income_ledger_status_check,
  add constraint hb_income_ledger_status_check
    check (status in ('pending', 'credited', 'locked', 'company_allocated', 'failed', 'cancelled'));

alter table hb_level_income_records
  drop constraint if exists hb_level_income_records_status_check,
  add constraint hb_level_income_records_status_check
    check (status in ('credited', 'company_reserved', 'locked'));

create index if not exists idx_hb_level_income_locked
  on hb_level_income_records (receiver_user_id, level_number, created_at desc)
  where status = 'locked';
