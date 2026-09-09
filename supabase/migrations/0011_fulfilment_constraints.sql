-- Basket intelligence must never surface a special tied to an inactive branch.
-- Preserve branch-less specials while excluding invalid inactive-branch offers.

create or replace function public.get_basket_intelligence_inputs(p_basket_id uuid)
returns table (
  product_id uuid,
  quantity integer,
  retailer_id uuid,
  retailer_name text,
  branch_id uuid,
  branch_name text,
  special_id uuid,
  special_price numeric,
  currency char(3)
)
language sql
security definer
set search_path = public
as $$
  select
    bi.product_id,
    bi.quantity,
    r.id,
    r.name,
    sb.id,
    sb.name,
    s.id,
    s.special_price,
    s.currency
  from public.shopping_basket_items bi
  join public.shopping_baskets b on b.id = bi.basket_id
  join public.products p on p.id = bi.product_id and p.verification_status = 'verified'
  join public.specials s on s.product_id = p.id
    and s.verification_status = 'verified'
    and s.starts_at <= now()
    and (s.ends_at is null or s.ends_at > now())
  join public.retailers r on r.id = s.retailer_id
    and r.status = 'active'
    and r.verification_status = 'verified'
  left join public.store_branches sb on sb.id = s.store_branch_id and sb.is_active = true
  where b.id = p_basket_id
    and b.user_id = auth.uid()
    and (s.store_branch_id is null or sb.id is not null)
  order by bi.product_id, s.special_price asc, r.name asc, s.id asc;
$$;

grant execute on function public.get_basket_intelligence_inputs(uuid) to authenticated;
