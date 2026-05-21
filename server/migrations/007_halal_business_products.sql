create table if not exists hb_product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists hb_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  short_description text,
  package_id uuid not null references hb_packages(id),
  package_price numeric(20, 8) not null,
  package_type text not null default 'activation',
  image_url text,
  stock integer not null default 0,
  active boolean not null default true,
  featured boolean not null default false,
  category_id uuid references hb_product_categories(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references hb_products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists hb_product_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  buyer_user_id uuid not null references hb_users(id),
  package_purchase_id uuid references hb_package_purchases(id),
  amount_usd numeric(20, 8) not null,
  payment_status text not null default 'paid' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  activation_status text not null default 'completed' check (activation_status in ('pending', 'completed', 'failed')),
  distribution_status text not null default 'completed' check (distribution_status in ('pending', 'completed', 'failed')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_product_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references hb_product_orders(id) on delete cascade,
  product_id uuid not null references hb_products(id),
  package_id uuid not null references hb_packages(id),
  title text not null,
  package_price numeric(20, 8) not null,
  quantity integer not null default 1,
  line_total_usd numeric(20, 8) not null,
  created_at timestamptz not null default now()
);

insert into hb_product_categories (name, slug)
values ('Activation Products', 'activation-products')
on conflict (slug) do nothing;

insert into hb_products (title, slug, description, short_description, package_id, package_price, package_type, image_url, stock, active, featured, category_id)
select product.title,
       product.slug,
       product.description,
       product.short_description,
       pkg.id,
       pkg.amount_usd,
       'activation',
       product.image_url,
       999999,
       true,
       product.featured,
       cat.id
from (
  values
    ('Starter Activation Product', 'starter-activation-product', 'Entry activation product mapped to the $4 package.', 'Entry activation product.', 4::numeric, '/tokens/bnb.svg', true),
    ('Builder Activation Product', 'builder-activation-product', 'Builder activation product mapped to the $20 package.', 'Builder activation product.', 20::numeric, '/tokens/usdt.svg', true),
    ('Growth Activation Product', 'growth-activation-product', 'Growth activation product mapped to the $100 package.', 'Growth activation product.', 100::numeric, '/tokens/usdc.svg', true),
    ('Business Activation Product', 'business-activation-product', 'Business activation product mapped to the $500 package.', 'Business activation product.', 500::numeric, '/tokens/eth.svg', false),
    ('Premium Activation Product', 'premium-activation-product', 'Premium activation product mapped to the $2500 package.', 'Premium activation product.', 2500::numeric, '/tokens/matic.svg', false),
    ('Enterprise Activation Product', 'enterprise-activation-product', 'Enterprise activation product mapped to the $12500 package.', 'Enterprise activation product.', 12500::numeric, '/tokens/btc.svg', false)
) as product(title, slug, description, short_description, amount_usd, image_url, featured)
join hb_packages pkg on pkg.amount_usd = product.amount_usd
left join hb_product_categories cat on cat.slug = 'activation-products'
on conflict (slug) do update
set package_id = excluded.package_id,
    package_price = excluded.package_price,
    active = excluded.active,
    updated_at = now();

create index if not exists idx_hb_products_active_featured on hb_products (active, featured, package_price);
create index if not exists idx_hb_orders_buyer_created on hb_product_orders (buyer_user_id, created_at desc);
create index if not exists idx_hb_product_images_product_order on hb_product_images (product_id, sort_order);
