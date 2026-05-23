alter table hb_deposits drop constraint if exists hb_deposits_status_check;
alter table hb_deposits
  add constraint hb_deposits_status_check
  check (status in ('pending', 'pending_verification', 'verified', 'rejected', 'failed'));

alter table hb_deposits drop constraint if exists hb_deposits_verification_status_check;
alter table hb_deposits
  add constraint hb_deposits_verification_status_check
  check (verification_status in ('pending', 'verified', 'rejected', 'failed'));
