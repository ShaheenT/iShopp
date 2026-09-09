-- iShopp development seed data
insert into public.retailers (name, slug, status)
values
  ('Checkers', 'checkers', 'active'),
  ('Shoprite', 'shoprite', 'active'),
  ('Pick n Pay', 'pick-n-pay', 'active'),
  ('Woolworths', 'woolworths', 'active')
on conflict (slug) do nothing;
