create or replace function public.accept_special_candidate(
  p_candidate_id uuid,
  p_actor_user_id uuid,
  p_reason text default null
)
returns public.specials
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate public.special_candidates;
  v_document public.catalogue_documents;
  v_extraction public.catalogue_extractions;
  v_evidence public.special_evidence;
  v_special public.specials;
  v_special_id uuid;
begin
  select * into v_candidate
  from public.special_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'special_candidate_not_found' using errcode = 'P0010';
  end if;

  if v_candidate.status <> 'pending' then
    raise exception 'special_candidate_not_pending' using errcode = 'P0011';
  end if;

  if v_candidate.product_id is null then
    raise exception 'special_candidate_product_required' using errcode = 'P0012';
  end if;

  if v_candidate.special_price is null or v_candidate.starts_at is null then
    raise exception 'special_candidate_offer_data_required' using errcode = 'P0013';
  end if;

  if v_candidate.ends_at is not null and v_candidate.ends_at <= v_candidate.starts_at then
    raise exception 'special_candidate_invalid_dates' using errcode = 'P0014';
  end if;

  select * into v_extraction
  from public.catalogue_extractions
  where id = v_candidate.extraction_id;

  if not found or v_extraction.status <> 'completed' then
    raise exception 'special_candidate_extraction_invalid' using errcode = 'P0015';
  end if;

  select * into v_document
  from public.catalogue_documents
  where id = v_extraction.document_id;

  if not found then
    raise exception 'special_candidate_document_not_found' using errcode = 'P0016';
  end if;

  insert into public.specials (
    product_id,
    retailer_id,
    store_branch_id,
    title,
    regular_price,
    special_price,
    currency,
    starts_at,
    ends_at,
    source_url,
    source_type,
    verification_status,
    verified_at
  ) values (
    v_candidate.product_id,
    v_candidate.retailer_id,
    v_candidate.store_branch_id,
    v_candidate.title,
    v_candidate.regular_price,
    v_candidate.special_price,
    v_candidate.currency,
    v_candidate.starts_at,
    v_candidate.ends_at,
    coalesce(v_candidate.source_url, v_document.source_url),
    coalesce(v_candidate.source_type, 'catalogue'),
    'pending',
    null
  ) returning * into v_special;

  insert into public.special_evidence (
    special_id,
    source_url,
    source_type,
    source_hash,
    captured_at,
    status,
    extracted_text,
    extracted_data,
    storage_path
  ) values (
    v_special.id,
    coalesce(v_candidate.source_url, v_document.source_url),
    coalesce(v_candidate.source_type, 'catalogue'),
    v_document.content_hash,
    v_document.captured_at,
    'processed',
    v_extraction.raw_text,
    jsonb_build_object(
      'candidate', v_candidate.raw_payload,
      'extraction', coalesce(v_extraction.extracted_data, '{}'::jsonb)
    ),
    v_document.storage_path
  ) returning * into v_evidence;

  v_special := public.verify_special(
    v_special.id,
    'verified'::public.verification_action,
    v_evidence.id,
    p_actor_user_id,
    p_reason
  );

  update public.special_candidates
  set status = 'accepted',
      updated_at = now()
  where id = p_candidate_id;

  return v_special;
end;
$$;

revoke all on function public.accept_special_candidate(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.accept_special_candidate(uuid, uuid, text) to service_role;
