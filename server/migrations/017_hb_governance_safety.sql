alter table hb_admin_action_logs
  add column if not exists ip_address text,
  add column if not exists before_snapshot jsonb,
  add column if not exists after_snapshot jsonb,
  add column if not exists proof_reference text;

create table if not exists hb_admin_operation_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  ip_address text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  proof_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_hb_admin_operation_logs_created on hb_admin_operation_logs (created_at desc);
create index if not exists idx_hb_admin_operation_logs_entity on hb_admin_operation_logs (entity_type, entity_id, created_at desc);

create table if not exists hb_risk_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references hb_users(id) on delete cascade,
  wallet_address text,
  risk_score integer not null check (risk_score >= 0 and risk_score <= 100),
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_hb_risk_score_snapshots_score on hb_risk_score_snapshots (risk_score desc, created_at desc);
create index if not exists idx_hb_risk_score_snapshots_user on hb_risk_score_snapshots (user_id, created_at desc);

create table if not exists hb_governance_settings (
  key text primary key,
  value text,
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into hb_governance_settings (key, value)
values
  ('multisig_owner_address', ''),
  ('package_manager_owner_expected', ''),
  ('treasury_splitter_owner_expected', ''),
  ('income_distributor_owner_expected', '')
on conflict (key) do nothing;
