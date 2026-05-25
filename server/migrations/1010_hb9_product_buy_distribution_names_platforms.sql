update hb_packages
set name = 'Starter Package',
    slug = 'starter-package',
    price = 4,
    status = 'available',
    active = true,
    visible = true,
    network = 'BSC',
    updated_at = now()
where amount_usd = 4;

update hb_packages
set name = 'Builder Package',
    slug = 'builder-package',
    price = 20,
    status = 'available',
    active = true,
    visible = true,
    network = 'BSC',
    updated_at = now()
where amount_usd = 20;

update hb_packages
set name = 'Growth Package',
    slug = 'growth-package',
    price = 100,
    status = 'available',
    active = true,
    visible = true,
    network = 'BSC',
    updated_at = now()
where amount_usd = 100;

update hb_packages
set name = 'Automation Package',
    slug = 'automation-package',
    price = 500,
    status = 'available',
    active = true,
    visible = true,
    network = 'BSC',
    updated_at = now()
where amount_usd = 500;

update hb_packages
set name = 'AI Business Package',
    slug = 'ai-business-package',
    price = 2500,
    status = 'available',
    active = true,
    visible = true,
    network = 'BSC',
    updated_at = now()
where amount_usd = 2500;

update hb_packages
set name = 'Enterprise Package',
    slug = 'enterprise-package',
    price = 12500,
    status = 'available',
    active = true,
    visible = true,
    network = 'BSC',
    updated_at = now()
where amount_usd = 12500;

update hb_products
set title = package_names.title,
    description = package_names.description,
    short_description = package_names.short_description,
    updated_at = now()
from (
  values
    (4::numeric, 'Starter Activation Product', 'Starter activation product mapped to the $4 package.', 'Starter activation product.'),
    (20::numeric, 'Builder Activation Product', 'Builder activation product mapped to the $20 package.', 'Builder activation product.'),
    (100::numeric, 'Growth Activation Product', 'Growth activation product mapped to the $100 package.', 'Growth activation product.'),
    (500::numeric, 'Automation Activation Product', 'Automation activation product mapped to the $500 package.', 'Automation activation product.'),
    (2500::numeric, 'AI Business Activation Product', 'AI Business activation product mapped to the $2500 package.', 'AI Business activation product.'),
    (12500::numeric, 'Enterprise Activation Product', 'Enterprise activation product mapped to the $12500 package.', 'Enterprise activation product.')
) as package_names(amount_usd, title, description, short_description)
where hb_products.package_price = package_names.amount_usd
  and hb_products.package_type = 'activation';

alter table hb_followers_requests
  add column if not exists platform text,
  add column if not exists submitted_link text,
  add column if not exists followers_count integer,
  add column if not exists admin_note text,
  add column if not exists completed_at timestamptz;

alter table hb_followers_requests
  drop constraint if exists hb_followers_requests_platform_check;

alter table hb_followers_requests
  add constraint hb_followers_requests_platform_check
  check (platform in ('Instagram', 'Facebook', 'Telegram', 'Twitter', 'YouTube'));
