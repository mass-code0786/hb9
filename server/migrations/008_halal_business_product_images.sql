alter table hb_products
  add column if not exists thumbnail_url text;

update hb_products
set thumbnail_url = image_url
where thumbnail_url is null
  and image_url is not null;

create index if not exists idx_hb_products_thumbnail_url on hb_products (thumbnail_url);
