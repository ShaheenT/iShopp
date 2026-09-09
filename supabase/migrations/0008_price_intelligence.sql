create or replace function public.get_product_price_intelligence(p_product_id uuid)
returns table (
  product_id uuid,
  sample_size bigint,
  lowest_price numeric,
  highest_price numeric,
  median_price numeric,
  current_price numeric,
  current_regular_price numeric,
  savings_percent numeric,
  price_vs_median_percent numeric,
  price_signal text
)
language sql
security definer
set search_path = public
as $$
  with verified_prices as (
    select s.special_price
    from public.specials s
    join public.products p on p.id = s.product_id
    where s.product_id = p_product_id
      and s.verification_status = 'verified'
      and p.verification_status = 'verified'
      and s.special_price >= 0
  ),
  stats as (
    select
      count(*)::bigint as sample_size,
      min(special_price) as lowest_price,
      max(special_price) as highest_price,
      percentile_cont(0.5) within group (order by special_price) as median_price
    from verified_prices
  ),
  current_special as (
    select s.special_price, s.regular_price
    from public.specials s
    where s.product_id = p_product_id
      and s.verification_status = 'verified'
      and s.starts_at <= now()
      and (s.ends_at is null or s.ends_at > now())
    order by s.starts_at desc, s.created_at desc
    limit 1
  )
  select
    p_product_id,
    stats.sample_size,
    stats.lowest_price,
    stats.highest_price,
    round(stats.median_price, 2),
    current_special.special_price,
    current_special.regular_price,
    case
      when current_special.regular_price is null or current_special.regular_price = 0 then null
      else round(((current_special.regular_price - current_special.special_price) / current_special.regular_price) * 100, 2)
    end,
    case
      when stats.median_price is null or stats.median_price = 0 or current_special.special_price is null then null
      else round(((current_special.special_price - stats.median_price) / stats.median_price) * 100, 2)
    end,
    case
      when current_special.special_price is null or stats.median_price is null then 'insufficient_data'
      when current_special.special_price < stats.median_price * 0.90 then 'exceptional'
      when current_special.special_price < stats.median_price * 0.97 then 'good'
      when current_special.special_price <= stats.median_price * 1.03 then 'typical'
      else 'high'
    end
  from stats
  left join current_special on true;
$$;

grant execute on function public.get_product_price_intelligence(uuid) to anon, authenticated;
