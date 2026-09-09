-- Community observations are submissions, not verified commercial facts.
-- They become trusted inputs only after an explicit verification transition.

create table public.community_price_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  store_branch_id uuid,
  observed_price numeric(12,2) not null,
  regular_price numeric(12,2),
  currency char(3) not null default 'ZAR',
  observed_at timestamptz not null default now(),
  source_type text not null default 'community',
  source_url text,
  notes text,
  verification_status public.verification_status not null default 'pending',
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verification_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_price_positive_check check (observed_price >= 0),
  constraint community_price_regular_check check (regular_price is null or regular_price >= observed_price),
  constraint community_price_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint community_price_verified_at_check check (verification_status <> 'verified' or verified_at is not null)
);

create unique index store_branches_id_retailer_unique_community
  on public.store_branches(id, retailer_id);

alter table public.community_price_submissions
  add constraint community_price_branch_retailer_fk
  foreign key (store_branch_id, retailer_id)
  references public.store_branches(id, retailer_id)
  on delete cascade;

create index community_price_product_idx
  on public.community_price_submissions(product_id, observed_at desc);
create index community_price_retailer_idx
  on public.community_price_submissions(retailer_id, observed_at desc);
create index community_price_user_idx
  on public.community_price_submissions(user_id, created_at desc);

create table public.community_price_evidence (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.community_price_submissions(id) on delete cascade,
  source_url text,
  storage_path text,
  source_hash text,
  captured_at timestamptz not null default now(),
  status public.evidence_status not null default 'captured',
  extracted_text text,
  extracted_data jsonb,
  created_at timestamptz not null default now(),
  constraint community_price_evidence_source_required check (source_url is not null or storage_path is not null)
);

create unique index community_price_evidence_hash_unique
  on public.community_price_evidence(submission_id, source_hash)
  where source_hash is not null;

create table public.community_price_verification_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.community_price_submissions(id) on delete cascade,
  action public.verification_action not null,
  previous_status public.verification_status,
  new_status public.verification_status not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  reason text,
  evidence_id uuid references public.community_price_evidence(id) on delete set null,
  created_at timestamptz not null default now()
);

create index community_price_verification_events_idx
  on public.community_price_verification_events(submission_id, created_at desc);

alter table public.community_price_submissions enable row level security;
alter table public.community_price_evidence enable row level security;
alter table public.community_price_verification_events enable row level security;

-- Users may see their own submissions; no direct writes are exposed.
create policy community_price_owner_select
on public.community_price_submissions
for select to authenticated
using (user_id = auth.uid());

revoke insert, update, delete on table public.community_price_submissions from authenticated;
revoke all on table public.community_price_evidence from anon, authenticated;
revoke all on table public.community_price_verification_events from anon, authenticated;

create or replace function public.set_community_price_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger community_price_updated_at
before update on public.community_price_submissions
for each row execute function public.set_community_price_updated_at();

create or replace function public.submit_community_price(
  p_product_id uuid,
  p_retailer_id uuid,
  p_store_branch_id uuid,
  p_observed_price numeric,
  p_regular_price numeric,
  p_currency char(3),
  p_observed_at timestamptz,
  p_source_url text,
  p_notes text,
  p_evidence_source_url text,
  p_evidence_storage_path text,
  p_evidence_source_hash text,
  p_evidence_extracted_text text,
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
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_evidence_source_url is null and p_evidence_storage_path is null then
    raise exception 'price evidence is required';
  end if;

  insert into public.community_price_submissions (
    user_id, product_id, retailer_id, store_branch_id, observed_price,
    regular_price, currency, observed_at, source_type, source_url, notes
  ) values (
    auth.uid(), p_product_id, p_retailer_id, p_store_branch_id, p_observed_price,
    p_regular_price, p_currency, coalesce(p_observed_at, now()), 'community', p_source_url, p_notes
  ) returning id into v_submission_id;

  insert into public.community_price_evidence (
    submission_id, source_url, storage_path, source_hash,
    status, extracted_text, extracted_data
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
end;
$$;

grant execute on function public.submit_community_price(
  uuid, uuid, uuid, numeric, numeric, char(3), timestamptz, text, text,
  text, text, text, text, jsonb
) to authenticated;

create or replace function public.get_verified_community_prices(p_product_id uuid)
returns table (
  submission_id uuid,
  retailer_id uuid,
  branch_id uuid,
  observed_price numeric,
  regular_price numeric,
  currency char(3),
  observed_at timestamptz,
  verified_at timestamptz
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
  join public.products p on p.id = cps.product_id and p.verification_status = 'verified'
  join public.retailers r on r.id = cps.retailer_id
    and r.status = 'active'
    and r.verification_status = 'verified'
  where cps.product_id = p_product_id
    and cps.verification_status = 'verified'
  order by cps.observed_at desc, cps.id asc;
$$;

grant execute on function public.get_verified_community_prices(uuid) to authenticated;
