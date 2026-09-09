create or replace function public.compare_product_prices(p_product_id uuid)
returns table (
  product_id uuid,
  retailer_id uuid,
  retailer_name text,
  retailer_slug text,
  branch_id uuid,
  branch_name text,
  special_id uuid,
  special_price numeric,
  regular_price numeric,
  currency char(3),
  starts_at timestamptz,
  ends_at timestamptz,
  savings_percent numeric,
  rank_position bigint
)
language sql
security definer
set search_path = public
as $$
  with active_specials as (
    select distinct on (s.retailer_id)
      s.product_id,
      s.retailer_id,
      r.name as retailer_name,
      r.slug as retailer_slug,
      s.store_branch_id,
      b.name as branch_name,
      s.id as special_id,
      s.special_price,
      s.regular_price,
      s.currency,
      s.starts_at,
      s.ends_at,
      case
        when s.regular_price is null or s.regular_price = 0 then null
        else round(((s.regular_price - s.special_price) / s.regular_price) * 100, 2)
      end as savings_percent
    from public.specials s
    join public.retailers r on r.id = s.retailer_id
    join public.products p on p.id = s.product_id
    left join public.store_branches b on b.id = s.store_branch_id
    where s.product_id = p_product_id
      and s.verification_status = 'verified'
      and p.verification_status = 'verified'
      and r.status = 'active'
      and r.verification_status = 'verified'
      and s.starts_at <= now()
      and (s.ends_at is null or s.ends_at > now())
    order by s.retailer_id, s.starts_at desc, s.created_at desc
  )
  select
    product_id,
    retailer_id,
    retailer_name,
    retailer_slug,
    store_branch_id,
    branch_name,
    special_id,
    special_price,
    regular_price,
    currency,
    starts_at,
    ends_at,
    savings_percent,
    row_number() over (order by special_price asc, retailer_name asc) as rank_position
  from active_specials
  order by special_price asc, retailer_name asc;
$$;

grant execute on function public.compare_product_prices(uuid) to anon, authenticated;
