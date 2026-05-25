create table if not exists hb_books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  cover_image text,
  download_url text not null,
  sort_order integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_hb_books_order
  on hb_books (is_active, sort_order, created_at);

insert into hb_books (title, cover_image, download_url, sort_order, is_active, created_at)
select title, cover_image, file_url, sort_order, status = 'active', created_at
from hb_product_library
where not exists (select 1 from hb_books)
order by sort_order asc, created_at asc
limit 100;
