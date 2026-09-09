-- Community submissions must point at already trusted catalogue entities.
-- This keeps malformed or commercially untrusted references out of the
-- pending-review queue and prevents future verification from becoming the
-- first place these relationships are discovered.

create or replace function public.submit_community_price(
  p_product_id uuid, p_retailer_id uuid, p_store_branch_id uuid,
  p_observed_price numeric, p_regular_price numeric, p_currency char(3),
  p_observed_at timestamptz, p_source_url text, p_notes text,
  p_evidence_source_url text, p_evidence_storage_path text,
  p_evidence_source_hash text, p_evidence_extracted_text text,
  p_evidence_extracted_data jsonb
)
returns table (submission_id uuid, verification_status public.verification_status, evidence_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission_id uuid;
  v_evidence_id uuid;
  v_observed_at timestamptz := coalesce(p_observed_at, now());
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_evidence_source_url is null and p_evidence_storage_path is null then
    raise exception 'price evidence is required';
  end if;

  if p_observed_price is null or p_observed_price <= 0 then
    raise exception 'observed price must be greater than zero';
  end if;

  if p_regular_price is not null and p_regular_price < p_observed_price then
    raise exception 'regular price cannot be below observed price';
  end if;

  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid currency';
  end if;

  if v_observed_at > now() + interval '5 minutes' then
    raise exception 'observed time cannot be in the future';
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.verification_status = 'verified'
  ) then
    raise exception 'verified product required';
  end if;

  if not exists (
    select 1
    from public.retailers r
    where r.id = p_retailer_id
      and r.status = 'active'
      and r.verification_status = 'verified'
  ) then
    raise exception 'verified active retailer required';
  end if;

  if p_store_branch_id is not null and not exists (
    select 1
    from public.store_branches sb
    where sb.id = p_store_branch_id
      and sb.retailer_id = p_retailer_id
      and sb.is_active
  ) then
    raise exception 'active retailer branch required';
  end if;

  insert into public.community_price_submissions (
    user_id, product_id, retailer_id, store_branch_id, observed_price, regular_price,
    currency, observed_at, source_type, source_url, notes
  ) values (
    auth.uid(), p_product_id, p_retailer_id, p_store_branch_id, p_observed_price, p_regular_price,
    p_currency, v_observed_at, 'community', p_source_url, p_notes
  )
  returning id into v_submission_id;

  insert into public.community_price_evidence (
    submission_id, source_url, storage_path, source_hash, status, extracted_text, extracted_data
  ) values (
    v_submission_id, p_evidence_source_url, p_evidence_storage_path, p_evidence_source_hash,
    'captured', p_evidence_extracted_text, coalesce(p_evidence_extracted_data, '{}'::jsonb)
  )
  returning id into v_evidence_id;

  insert into public.community_price_verification_events (
    submission_id, action, previous_status, new_status, actor_user_id, reason, evidence_id
  ) values (
    v_submission_id, 'submitted', null, 'pending', auth.uid(), 'Community price submitted', v_evidence_id
  );

  return query
    select v_submission_id, 'pending'::public.verification_status, v_evidence_id;
end;
$$;

revoke all on function public.submit_community_price(
  uuid, uuid, uuid, numeric, numeric, char(3), timestamptz, text, text,
  text, text, text, text, jsonb
) from public;

grant execute on function public.submit_community_price(
  uuid, uuid, uuid, numeric, numeric, char(3), timestamptz, text, text,
  text, text, text, text, jsonb
) to authenticated;
