create table if not exists hb_product_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  description text,
  file_url text not null,
  cover_image text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into hb_product_library (title, category, description, file_url, cover_image, status, sort_order)
select
  'HB9 Business Book ' || gs::text,
  case
    when gs <= 20 then 'Business'
    when gs <= 40 then 'Marketing'
    when gs <= 60 then 'Automation'
    when gs <= 80 then 'Finance'
    else 'Growth'
  end,
  'Premium HB9 digital learning book #' || gs::text,
  '/hb-books/book-' || lpad(gs::text, 3, '0') || '.pdf',
  '/tokens/usdt.svg',
  'active',
  gs
from generate_series(1, 100) as gs
on conflict do nothing;

create table if not exists hb_user_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  package_purchase_id uuid references hb_package_purchases(id) on delete cascade,
  package_id uuid references hb_packages(id),
  package_name text not null,
  package_amount numeric(20, 8) not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  activated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (package_purchase_id)
);

create table if not exists hb_book_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  book_id uuid not null references hb_product_library(id) on delete cascade,
  package_purchase_id uuid references hb_package_purchases(id),
  downloaded_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create table if not exists hb_followers_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  package_id uuid references hb_packages(id),
  package_purchase_id uuid references hb_package_purchases(id),
  platform text not null check (platform in ('Instagram', 'Facebook', 'Telegram', 'Twitter', 'YouTube')),
  submitted_link text not null,
  followers_count integer not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_hb_followers_one_active_per_package
  on hb_followers_requests (user_id, package_purchase_id)
  where status in ('pending', 'processing');

create table if not exists hb_software_access (
  id uuid primary key default gen_random_uuid(),
  package_amount numeric(20, 8) not null,
  software_key text not null,
  title text not null,
  description text,
  access_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (package_amount, software_key)
);

insert into hb_software_access (package_amount, software_key, title, description, access_url, sort_order)
values
  (500, 'whatsapp_automation', 'WhatsApp Automatic Message Software', 'Automation software access included with $500+ packages.', '/software/whatsapp-automation', 1),
  (2500, 'ai_calling_agent', 'AI Calling Agent', 'AI calling agent access included with $2500+ packages.', '/software/ai-calling-agent', 2),
  (2500, 'meta_auto_ads_ai', 'Meta Auto Ads AI Software', 'Meta ads automation access included with $2500+ packages.', '/software/meta-auto-ads-ai', 3),
  (12500, 'custom_software_1', 'Custom Software Request 1', 'Custom software request slot.', '/software/custom-request', 4),
  (12500, 'custom_software_2', 'Custom Software Request 2', 'Custom software request slot.', '/software/custom-request', 5),
  (12500, 'custom_software_3', 'Custom Software Request 3', 'Custom software request slot.', '/software/custom-request', 6)
on conflict (package_amount, software_key) do update
set title = excluded.title,
    description = excluded.description,
    access_url = excluded.access_url,
    sort_order = excluded.sort_order,
    active = true;

create table if not exists hb_custom_software_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  package_purchase_id uuid references hb_package_purchases(id),
  software_type text not null,
  architecture text not null check (architecture in ('centralized', 'decentralized')),
  requirements_note text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
