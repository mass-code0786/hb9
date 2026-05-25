create table if not exists hb_product_resources (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references hb_products(id) on delete cascade,
  title text not null,
  type text not null,
  download_url text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hb_product_resources_product_active
  on hb_product_resources (product_id, active, sort_order);

create table if not exists hb_product_resource_access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  product_resource_id uuid not null references hb_product_resources(id) on delete cascade,
  package_purchase_id uuid references hb_package_purchases(id),
  action text not null check (action in ('open', 'download', 'copy')),
  created_at timestamptz not null default now()
);

create index if not exists idx_hb_product_resource_access_user_resource
  on hb_product_resource_access_logs (user_id, product_resource_id, created_at desc);
