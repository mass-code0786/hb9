insert into product_delivery_links (product_id, title, url, type, category, thumbnail_url, sort_order, is_active)
select p.id,
       resource.title,
       resource.url,
       resource.type,
       resource.category,
       coalesce(p.thumbnail_url, p.image_url, '/tokens/usdt.svg'),
       resource.sort_order,
       true
from hb_products p
cross join (
  values
    ('Urdu Books Bundle Pack 1', 'https://drive.google.com/file/d/16UblkRAruXUY7j8fa9-R4HwiGajQQQQK/view?usp=sharing', 'pdf', 'Urdu Books', 10),
    ('Urdu Books Bundle Pack 2', 'https://drive.google.com/drive/folders/1caRb3EfC78mjqEfzxy2oI1lrAXAqiruK?usp=sharing', 'folder', 'Urdu Books', 20),
    ('Hadees Books Set', 'https://drive.google.com/drive/folders/1z7n3aodezeZWy8kMn2ZYF_5Mq2YaHKMB', 'folder', 'Urdu Books', 30),
    ('Urdu Trading Books', 'https://drive.google.com/drive/folders/1g2gf8n8KmNNEPv3jeCSolKxXz5srL7iJ', 'folder', 'Urdu Books', 40),
    ('Animal Books', 'https://drive.google.com/drive/folders/1NNw6EUuNoSY2ohWEDaDhNTpfb4KAMoHS', 'folder', 'Animal & Farming', 50),
    ('Agriculture Farming Books', 'https://drive.google.com/drive/folders/14KJwZOLFR0GNbe8v_2yeFqgK0tnXksid', 'folder', 'Animal & Farming', 60),
    ('Animal Gift', 'https://drive.google.com/drive/folders/1fcJeeShN7H9ihDtNC8TTAXcZczNc2kC4', 'folder', 'Animal & Farming', 70),
    ('Trading Paid Video Courses', 'https://drive.google.com/drive/folders/1QN9hy6_BmPEBqHdgy8Ak4WFpxr1YjACq', 'course', 'Trading & Business', 80),
    ('Business & Online Earnings Premium English Books', 'https://drive.google.com/drive/folders/1Ui8d8I7NLdm1Ed2pdCZo9PNu08FGDJ_G?usp=sharing', 'folder', 'Trading & Business', 90),
    ('English Books Bundle Pack 1', 'https://drive.google.com/drive/folders/1QHAa37WThWAaPNtNdxIxrBEXCxAbu1ON', 'folder', 'English Books', 100),
    ('English Books Bundle Pack 2', 'https://drive.google.com/file/d/1JMLUo0W8jnszX9bC6ZRLHDUCCr0otJfj/view?usp=sharing', 'pdf', 'English Books', 110),
    ('1000 PLR & MRR Ebooks Bundle', 'https://docs.google.com/document/d/1umYV5YXkOsuUD82MozzKBOvrX3BnSsps/edit?usp=sharing&ouid=105471063375515252471&rtpof=true&sd=true', 'ebook', 'English Books', 120),
    ('Premium Mix EBooks Mega Bundle Pack 1', 'https://drive.google.com/drive/folders/1TaT8xs_AutAE2g5ogeJIBXrUEW5hKtF6', 'folder', 'Premium Mix', 130),
    ('Premium Mix EBooks Mega Bundle Pack 2', 'https://drive.google.com/drive/folders/1mnk3c977mEVao1iDjELtzUn6OygKDfyM', 'folder', 'Premium Mix', 140),
    ('Premium Mix EBooks Mega Bundle Pack 3', 'https://drive.google.com/drive/folders/1ELJSvUW5W8bBe7T1ABohC21fVNFnItL7?usp=drive_link', 'folder', 'Premium Mix', 150),
    ('Premium Mix EBooks Mega Bundle Pack 4', 'https://drive.google.com/drive/folders/1MJzie4ZXsMVosm6ejaAdcuMVMMLJ8XHf?usp=drive_link', 'folder', 'Premium Mix', 160),
    ('Fitness EBooks Bundle', 'https://drive.google.com/drive/folders/1H2DEtHcA5MX6W57xLOs-pNIJOHEAJy99?usp=sharing', 'folder', 'Fitness', 170)
) as resource(title, url, type, category, sort_order)
where false
on conflict (product_id, title, url) do update
set type = excluded.type,
    category = excluded.category,
    thumbnail_url = excluded.thumbnail_url,
    sort_order = excluded.sort_order,
    is_active = true;
