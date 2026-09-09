-- Prevent accidental duplicate community contributions and make retries safe.
-- The browser receives an idempotency key once and may safely retry the same
-- submission without creating another contribution.

alter table public.community_price_submissions
  add column if not exists idempotency_key uuid;

create unique index if not exists community_price_submission_idempotency_unique
  on public.community_price_submissions(user_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.submit_community_price(
  p_product_id uuid, p_retailer_id uuid, p_store_branch_id uuid,
  p_observed_price numeric, p_regular_price numeric, p_currency char(3),
  p_observed_at timestamptz, p_source_url text, p_notes text,
  p_evidence_source_url text, p_evidence_storage_path text,
  p_evidence_source_hash text, p_evidence_extracted_text text,
  p_evidence_extracted_data jsonb,
  p_idempotency_key uuid default null
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

  if p_idempotency_key is not null then
    select cps.id, cps.verification_status, e.id
      into v_submission_id, v_evidence_id
    from public.community_price_submissions cps
    left join public.community_price_evidence e on e.submission_id = cps.id
    where cps.user_id = auth.uid() and cps.idempotency_key = p_idempotency_key
    order by e.created_at asc nulls last
    limit 1;

    if found then
      return query select v_submission_id, (
        select verification_status from public.community_price_submissions where id = v_submission_id
      ), v_evidence_id;
      return;
    end if;
  end if;

  insert into public.community_price_submissions (
    user_id, product_id, retailer_id, store_branch_id, observed_price, regular_price,
    currency, observed_at, source_type, source_url, notes, idempotency_key
  ) values (
    auth.uid(), p_product_id, p_retailer_id, p_store_branch_id, p_observed_price, p_regular_price,
    p_currency, coalesce(p_observed_at, now()), 'community', p_source_url, p_notes, p_idempotency_key
  ) returning id into v_submission_id;

  insert into public.community_price_evidence (
    submission_id, source_url, storage_path, source_hash, status, extracted_text, extracted_data
  ) values (
    v_submission_id, p_evidence_source_url, p_evidence_storage_path, p_evidence_source_hash,
    'captured', p_evidence_extracted_text, coalesce(p_evidence_extracted_data, '{}'::jsonb)
  ) returning id into v_evidence_id;

  insert into public.community_price_verification_events (
    submission_id, action, previous_status, new_status, actor_user_id, reason, evidence_id
  ) values (
    v_submission_id, 'submitted', null, 'pending', auth.uid(), 'Community price submitted', v_evidence_id
  );

  return query select v_submission_id, 'pending'::public.verification_status, v_evidence_id;
exception
  when unique_violation then
    if p_idempotency_key is null then raise; end if;
    select cps.id, cps.verification_status, e.id
      into v_submission_id, v_evidence_id
    from public.community_price_submissions cps
    left join public.community_price_evidence e on e.submission_id = cps.id
    where cps.user_id = auth.uid() and cps.idempotency_key = p_idempotency_key
    order by e.created_at asc nulls last
    limit 1;
    if not found then raise; end if;
    return query select v_submission_id, (
      select verification_status from public.community_price_submissions where id = v_submission_id
    ), v_evidence_id;
end;
$$;

revoke all on function public.submit_community_price(
  uuid, uuid, uuid, numeric, numeric, char(3), timestamptz, text, text,
  text, text, text, text, jsonb
) from public;
revoke all on function public.submit_community_price(
  uuid, uuid, uuid, numeric, numeric, char(3), timestamptz, text, text,
  text, text, text, text, jsonb, uuid
) from public;
grant execute on function public.submit_community_price(
  uuid, uuid, uuid, numeric, numeric, char(3), timestamptz, text, text,
  text, text, text, text, jsonb, uuid
) to authenticated;
