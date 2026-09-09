-- Risk signals must use the same active commercial scope as trusted price reads.
-- Inactive branches must not influence a verifier's median or duplicate signal.

create or replace function public.get_community_price_risk(p_submission_id uuid)
returns table (
  submission_id uuid,
  risk_score integer,
  risk_flags text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_product_id uuid;
  v_retailer_id uuid;
  v_branch_id uuid;
  v_price numeric;
  v_currency text;
  v_observed_at timestamptz;
  v_median numeric;
  v_duplicate_count integer;
  v_velocity_count integer;
  v_reviewed_count integer;
  v_rejected_count integer;
  v_score integer := 0;
  v_flags text[] := array[]::text[];
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1
    from public.community_price_verifiers
    where user_id = auth.uid() and is_active
  ) then
    raise exception 'community price verification access denied';
  end if;

  select user_id, product_id, retailer_id, store_branch_id, observed_price, currency, observed_at
    into v_user_id, v_product_id, v_retailer_id, v_branch_id, v_price, v_currency, v_observed_at
  from public.community_price_submissions
  where id = p_submission_id;

  if not found then
    raise exception 'community price submission not found';
  end if;

  select percentile_cont(0.5) within group (order by s.observed_price)
    into v_median
  from public.community_price_submissions s
  join public.products p
    on p.id = s.product_id
   and p.verification_status = 'verified'
  join public.retailers r
    on r.id = s.retailer_id
   and r.status = 'active'
   and r.verification_status = 'verified'
  left join public.store_branches sb
    on sb.id = s.store_branch_id
  where s.product_id = v_product_id
    and s.currency = v_currency
    and s.verification_status = 'verified'
    and (
      s.store_branch_id is null
      or (
        sb.id is not null
        and sb.retailer_id = s.retailer_id
        and sb.is_active
      )
    );

  if v_median is not null and v_median > 0 and abs(v_price - v_median) / v_median >= 0.50 then
    v_score := v_score + 30;
    v_flags := array_append(v_flags, 'extreme_deviation_from_verified_median');
  end if;

  select count(*)::integer
    into v_duplicate_count
  from public.community_price_submissions s
  left join public.store_branches sb
    on sb.id = s.store_branch_id
  where s.user_id = v_user_id
    and s.product_id = v_product_id
    and s.retailer_id = v_retailer_id
    and s.currency = v_currency
    and s.observed_price = v_price
    and s.observed_at >= v_observed_at - interval '24 hours'
    and s.observed_at <= v_observed_at + interval '24 hours'
    and s.id <> p_submission_id
    and (
      (s.store_branch_id is null and v_branch_id is null)
      or (
        s.store_branch_id = v_branch_id
        and sb.id is not null
        and sb.retailer_id = s.retailer_id
        and sb.is_active
      )
    );

  if v_duplicate_count > 0 then
    v_score := v_score + 25;
    v_flags := array_append(v_flags, 'duplicate_observation');
  end if;

  select count(*)::integer
    into v_velocity_count
  from public.community_price_submissions s
  where s.user_id = v_user_id
    and s.created_at >= now() - interval '24 hours';

  if v_velocity_count > 10 then
    v_score := v_score + 15;
    v_flags := array_append(v_flags, 'high_submission_velocity');
  end if;

  select
    count(*) filter (where verification_status in ('verified','rejected'))::integer,
    count(*) filter (where verification_status = 'rejected')::integer
  into v_reviewed_count, v_rejected_count
  from public.community_price_submissions
  where user_id = v_user_id;

  if v_reviewed_count >= 5 and (v_rejected_count::numeric / v_reviewed_count::numeric) >= 0.40 then
    v_score := v_score + 20;
    v_flags := array_append(v_flags, 'high_rejection_rate');
  end if;

  return query
    select p_submission_id, least(100, v_score), v_flags;
end;
$$;

revoke all on function public.get_community_price_risk(uuid) from public;
grant execute on function public.get_community_price_risk(uuid) to authenticated;
