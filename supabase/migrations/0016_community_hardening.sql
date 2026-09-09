-- Recalculation is an internal primitive; callers use the summary RPC instead.
revoke execute on function public.recalculate_community_trust(uuid) from authenticated;

create or replace function public.submit_community_price(
  p_product_id uuid, p_retailer_id uuid, p_store_branch_id uuid,
  p_observed_price numeric, p_regular_price numeric, p_currency char(3),
  p_observed_at timestamptz, p_source_url text, p_notes text,
  p_evidence_source_url text, p_evidence_storage_path text,
  p_evidence_source_hash text, p_evidence_extracted_text text,
  p_evidence_extracted_data jsonb
)
returns table (submission_id uuid, verification_status public.verification_status, evidence_id uuid)
language plpgsql security definer set search_path = public
as $$
declare
  v_submission_id uuid;
  v_evidence_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_evidence_source_url is null and p_evidence_storage_path is null then raise exception 'price evidence is required'; end if;
  if exists (
    select 1 from public.community_price_submissions
    where user_id = auth.uid()
      and product_id = p_product_id
      and retailer_id = p_retailer_id
      and observed_price = p_observed_price
      and observed_at >= now() - interval '24 hours'
  ) then
    raise exception 'duplicate community price observation';
  end if;
  if (
    select count(*) from public.community_price_submissions
    where user_id = auth.uid() and created_at >= date_trunc('day', now())
  ) >= 30 then
    raise exception 'daily community contribution limit reached';
  end if;

  insert into public.community_price_submissions (
    user_id, product_id, retailer_id, store_branch_id, observed_price, regular_price,
    currency, observed_at, source_type, source_url, notes
  ) values (
    auth.uid(), p_product_id, p_retailer_id, p_store_branch_id, p_observed_price, p_regular_price,
    currency, coalesce(p_observed_at, now()), 'community', p_source_url, p_notes
  ) returning id into v_submission_id;

  insert into public.community_price_evidence (
    submission_id, source_url, storage_path, source_hash, status, extracted_text, extracted_data
  ) values (
    v_submission_id, p_evidence_source_url, p_evidence_storage_path, p_evidence_source_hash,
    'captured', p_evidence_extracted_text, coalesce(p_evidence_extracted_data, '{}'::jsonb)
  ) returning id into v_evidence_id;

  insert into public.community_price_verification_events
    (submission_id, action, previous_status, new_status, actor_user_id, reason, evidence_id)
  values
    (v_submission_id, 'submitted', null, 'pending', auth.uid(), 'Community price submitted', v_evidence_id);

  return query select v_submission_id, 'pending'::public.verification_status, v_evidence_id;
end;
$$;

-- Keep the trusted read model separate from canonical retailer specials.
create or replace function public.get_community_price_intelligence(p_product_id uuid)
returns table (
  product_id uuid,
  currency char(3),
  sample_size bigint,
  lowest_price numeric,
  highest_price numeric,
  median_price numeric,
  latest_price numeric,
  latest_observed_at timestamptz
)
language sql
security definer set search_path = public
as $$
  with verified as (
    select cps.product_id, cps.currency, cps.observed_price, cps.observed_at
    from public.community_price_submissions cps
    join public.products p on p.id = cps.product_id and p.verification_status = 'verified'
    join public.retailers r on r.id = cps.retailer_id and r.status = 'active' and r.verification_status = 'verified'
    where cps.product_id = p_product_id and cps.verification_status = 'verified'
  ),
  currencies as (
    select currency from verified group by currency order by count(*) desc, currency asc limit 1
  ),
  scoped as (
    select v.* from verified v join currencies c using (currency)
  ),
  latest as (
    select observed_price, observed_at from scoped order by observed_at desc limit 1
  )
  select
    p_product_id,
    (select currency from currencies),
    count(*)::bigint,
    min(observed_price),
    max(observed_price),
    percentile_cont(0.5) within group (order by observed_price)::numeric,
    (select observed_price from latest),
    (select observed_at from latest)
  from scoped;
$$;

grant execute on function public.get_community_price_intelligence(uuid) to authenticated;
