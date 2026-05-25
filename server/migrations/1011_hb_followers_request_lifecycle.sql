alter table hb_followers_requests
  add column if not exists package_purchase_id uuid references hb_package_purchases(id);

drop index if exists idx_hb_followers_one_active_per_package;

with ranked as (
  select id,
         row_number() over (
           partition by user_id, package_purchase_id
           order by created_at desc, id desc
         ) as rn
  from hb_followers_requests
  where package_purchase_id is not null
    and status in ('pending', 'approved', 'processing', 'completed')
)
update hb_followers_requests r
set status = 'rejected',
    admin_note = coalesce(r.admin_note, 'Duplicate request closed during lifecycle cleanup.'),
    updated_at = now()
from ranked
where r.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists idx_hb_followers_one_active_per_purchase
  on hb_followers_requests (user_id, package_purchase_id)
  where package_purchase_id is not null
    and status in ('pending', 'approved', 'processing', 'completed');
