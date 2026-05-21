alter table hb_packages
  add column if not exists description text,
  add column if not exists image_url text;

create table if not exists hb_admin_notes (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  entity_type text not null,
  entity_id uuid,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_hb_admin_notes_entity on hb_admin_notes (entity_type, entity_id);
