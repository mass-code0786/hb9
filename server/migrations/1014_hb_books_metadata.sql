alter table hb_books
  add column if not exists description text,
  add column if not exists package_tier integer not null default 4;
