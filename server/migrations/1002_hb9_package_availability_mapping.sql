alter table hb_packages
  add column if not exists slug text,
  add column if not exists price numeric(20, 8),
  add column if not exists active boolean not null default true,
  add column if not exists visible boolean not null default true,
  add column if not exists network text not null default 'BSC';

update hb_packages
set slug = coalesce(slug, lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))),
    price = coalesce(price, amount_usd),
    active = case when status = 'available' then true else active end,
    visible = true,
    network = 'BSC'
where amount_usd in (4, 20, 100, 500, 2500, 12500);

insert into hb_packages (name, slug, amount_usd, status, sort_order, active, visible, network)
values
  ('Starter Package', 'starter-package', 4, 'available', 1, true, true, 'BSC'),
  ('Growth Package', 'growth-package', 20, 'available', 2, true, true, 'BSC'),
  ('Popular Package', 'popular-package', 100, 'available', 3, true, true, 'BSC'),
  ('Automation Package', 'automation-package', 500, 'available', 4, true, true, 'BSC'),
  ('AI Business Package', 'ai-business-package', 2500, 'available', 5, true, true, 'BSC'),
  ('Enterprise Package', 'enterprise-package', 12500, 'available', 6, true, true, 'BSC')
on conflict (amount_usd) do update
set name = excluded.name,
    slug = excluded.slug,
    status = excluded.status,
    sort_order = excluded.sort_order,
    active = true,
    visible = true,
    price = excluded.amount_usd,
    network = 'BSC',
    updated_at = now();

create unique index if not exists idx_hb_packages_slug on hb_packages (slug) where slug is not null;
create index if not exists idx_hb_packages_visible_active on hb_packages (active, visible, status, sort_order);

create table if not exists hb_package_contract_mappings (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references hb_packages(id) on delete cascade,
  package_contract_id integer not null,
  onchain_package_id integer not null,
  network text not null default 'BSC',
  chain_id integer not null default 56,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (package_id, network),
  unique (network, package_contract_id),
  unique (network, onchain_package_id)
);

insert into hb_package_contract_mappings (package_id, package_contract_id, onchain_package_id, network, chain_id, active)
select p.id,
       mapping.contract_id,
       mapping.contract_id,
       'BSC',
       56,
       true
from (
  values
    (4::numeric, 1),
    (20::numeric, 2),
    (100::numeric, 3),
    (500::numeric, 4),
    (2500::numeric, 5),
    (12500::numeric, 6)
) as mapping(amount_usd, contract_id)
join hb_packages p on p.amount_usd = mapping.amount_usd
on conflict (package_id, network) do update
set package_contract_id = excluded.package_contract_id,
    onchain_package_id = excluded.onchain_package_id,
    chain_id = excluded.chain_id,
    active = true,
    updated_at = now();

insert into hb_products (title, slug, description, short_description, package_id, package_price, package_type, image_url, stock, active, featured)
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
       product.featured
from (
  values
    ('Starter Activation Product', 'starter-activation-product', 'Entry activation product mapped to the $4 package.', 'Entry activation product.', 4::numeric, '/tokens/bnb.svg', true),
    ('Growth Activation Product', 'growth-activation-product', 'Growth activation product mapped to the $20 package.', 'Growth activation product.', 20::numeric, '/tokens/usdt.svg', true),
    ('Popular Activation Product', 'popular-activation-product', 'Popular activation product mapped to the $100 package.', 'Popular activation product.', 100::numeric, '/tokens/usdc.svg', true),
    ('Automation Activation Product', 'automation-activation-product', 'Automation activation product mapped to the $500 package.', 'Automation activation product.', 500::numeric, '/tokens/eth.svg', false),
    ('AI Business Activation Product', 'ai-business-activation-product', 'AI Business activation product mapped to the $2500 package.', 'AI Business activation product.', 2500::numeric, '/tokens/matic.svg', false),
    ('Enterprise Activation Product', 'enterprise-activation-product', 'Enterprise activation product mapped to the $12500 package.', 'Enterprise activation product.', 12500::numeric, '/tokens/btc.svg', false)
) as product(title, slug, description, short_description, amount_usd, image_url, featured)
join hb_packages pkg on pkg.amount_usd = product.amount_usd
on conflict (slug) do update
set package_id = excluded.package_id,
    package_price = excluded.package_price,
    active = true,
    stock = greatest(hb_products.stock, 999999),
    updated_at = now();
