create table public.fulfilment_ingestors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fulfilment_ingestors enable row level security;
revoke all on table public.fulfilment_ingestors from anon, authenticated;

create or replace function public.ingest_fulfilment_rule(
  p_retailer_id uuid,
  p_store_branch_id uuid,
  p_fulfilment_mode text,
  p_delivery_fee numeric,
  p_minimum_order_value numeric,
  p_currency char(3),
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_source_url text,
  p_source_type text,
  p_source_hash text,
  p_evidence_storage_path text,
  p_evidence_extracted_text text,
  p_evidence_extracted_data jsonb,
  p_evidence_source_url text,
  p_evidence_source_hash text
)
returns table (rule_id uuid, evidence_id uuid, verification_status public.verification_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule_id uuid;
  v_evidence_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1 from public.fulfilment_ingestors fi
    where fi.user_id = auth.uid() and fi.is_active = true
  ) then
    raise exception 'fulfilment ingestion access denied';
  end if;

  if p_source_url is null and p_source_hash is null then
    raise exception 'rule source evidence is required';
  end if;

  if p_evidence_storage_path is null and p_evidence_source_url is null then
    raise exception 'usable evidence is required';
  end if;

  insert into public.fulfilment_rules (
    retailer_id, store_branch_id, fulfilment_mode, delivery_fee,
    minimum_order_value, currency, starts_at, ends_at, source_url,
    source_type, source_hash, verification_status
  ) values (
    p_retailer_id, p_store_branch_id, p_fulfilment_mode, p_delivery_fee,
    p_minimum_order_value, p_currency, p_starts_at, p_ends_at, p_source_url,
    p_source_type, p_source_hash, 'pending'
  ) returning id into v_rule_id;

  insert into public.fulfilment_evidence (
    fulfilment_rule_id, source_url, source_type, source_hash,
    status, extracted_text, extracted_data, storage_path
  ) values (
    v_rule_id,
    p_evidence_source_url,
    p_source_type,
    p_evidence_source_hash,
    'captured',
    p_evidence_extracted_text,
    coalesce(p_evidence_extracted_data, '{}'::jsonb),
    p_evidence_storage_path
  ) returning id into v_evidence_id;

  insert into public.fulfilment_verification_events (
    fulfilment_rule_id, action, previous_status, new_status,
    actor_user_id, reason, evidence_id
  ) values (
    v_rule_id, 'submitted', null, 'pending', auth.uid(), 'Ingested for verification', v_evidence_id
  );

  return query select v_rule_id, v_evidence_id, 'pending'::public.verification_status;
end;
$$;

grant execute on function public.ingest_fulfilment_rule(
  uuid, uuid, text, numeric, numeric, char(3), timestamptz, timestamptz,
  text, text, text, text, text, jsonb, text, text
) to authenticated;

create or replace function public.verify_fulfilment_rule(
  p_rule_id uuid,
  p_reason text
)
returns table (rule_id uuid, verification_status public.verification_status, verified_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous public.verification_status;
  v_verified_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1 from public.fulfilment_ingestors fi
    where fi.user_id = auth.uid() and fi.is_active = true
  ) then
    raise exception 'fulfilment verification access denied';
  end if;

  select verification_status into v_previous
  from public.fulfilment_rules
  where id = p_rule_id
  for update;

  if not found then
    raise exception 'fulfilment rule not found';
  end if;

  if v_previous <> 'pending' then
    raise exception 'only pending fulfilment rules can be verified';
  end if;

  if not exists (
    select 1 from public.fulfilment_evidence fe
    where fe.fulfilment_rule_id = p_rule_id
      and fe.status in ('captured', 'processed')
      and (fe.source_url is not null or fe.storage_path is not null)
  ) then
    raise exception 'usable evidence required before verification';
  end if;

  update public.fulfilment_rules
  set verification_status = 'verified',
      verified_at = v_verified_at,
      verified_by = auth.uid(),
      verification_reason = p_reason
  where id = p_rule_id;

  insert into public.fulfilment_verification_events (
    fulfilment_rule_id, action, previous_status, new_status,
    actor_user_id, reason
  ) values (
    p_rule_id, 'verified', v_previous, 'verified', auth.uid(), p_reason
  );

  return query select p_rule_id, 'verified'::public.verification_status, v_verified_at;
end;
$$;

grant execute on function public.verify_fulfilment_rule(uuid, text) to authenticated;
