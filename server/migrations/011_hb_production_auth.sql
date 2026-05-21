alter table hb_users
  add column if not exists mobile_number text,
  add column if not exists last_login_at timestamptz,
  add column if not exists failed_login_count integer not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists password_changed_at timestamptz,
  add column if not exists reset_required boolean not null default false;

alter table hb_users
  alter column email drop not null;

create unique index if not exists idx_hb_users_mobile_unique
  on hb_users (mobile_number)
  where mobile_number is not null;

create unique index if not exists idx_hb_users_email_lower_unique
  on hb_users (lower(email))
  where email is not null;

create table if not exists hb_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  token_jti text not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text,
  ip_address text,
  created_at timestamptz not null default now()
);

create table if not exists hb_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  token_hash text not null unique,
  delivery_target text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_hb_auth_sessions_user_created on hb_auth_sessions (user_id, created_at desc);
create index if not exists idx_hb_password_reset_user_created on hb_password_reset_tokens (user_id, created_at desc);
