-- Verified community prices must remain commercially usable at read time.
-- A previously verified observation must not survive as a trusted branch price
-- after that branch is deactivated or detached from its retailer.

create or replace function public.get_verified_community_prices(p_product_id uuid)
returns table (
  submission_id uuid, retailer_id uuid, branch_id uuid, observed_price numeric,
  regular_price numeric, currency char(3), observed_at timestamptz, verified_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    cps.id,
    cps.retailer_id,
    cps.store_branch_id,
    cps.observed_price,
    cps.regular_price,
    cps.currency,
    cps.observed_at,
    cps.verified_at
  from public.community_price_submissions cps
  join public.products p
    on p.id = cps.product_id
   and p.verification_status = 'verified'
  join public.retailers r
    on r.id = cps.retailer_id
   and r.status = 'active'
   and r.verification_status = 'verified'
  left join public.store_branches sb
    on sb.id = cps.store_branch_id
  where cps.product_id = p_product_id
    and cps.verification_status = 'verified'
    and (
      cps.store_branch_id is null
      or (
        sb.id is not null
        and sb.retailer_id = cps.retailer_id
        and sb.is_active
      )
    )
  order by cps.observed_at desc, cps.id asc;
$$;

grant execute on function public.get_verified_community_prices(uuid) to authenticated;
