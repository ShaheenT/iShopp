create type public.catalogue_document_status as enum ('queued', 'processing', 'processed', 'failed');
create type public.catalogue_extraction_status as enum ('queued', 'processing', 'completed', 'failed');
create type public.special_candidate_status as enum ('pending', 'accepted', 'rejected');

create table public.catalogue_documents (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  store_branch_id uuid references public.store_branches(id) on delete set null,
  source_url text,
  storage_path text,
  content_hash text,
  mime_type text not null,
  original_filename text,
  captured_at timestamptz not null default now(),
  status public.catalogue_document_status not null default 'queued',
  page_count integer,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalogue_document_source_required check (
    source_url is not null or storage_path is not null
  ),
  constraint catalogue_document_page_count_valid check (
    page_count is null or page_count > 0
  )
);

create unique index catalogue_documents_retailer_hash_unique
  on public.catalogue_documents(retailer_id, content_hash)
  where content_hash is not null;

create index catalogue_documents_retailer_idx
  on public.catalogue_documents(retailer_id, created_at desc);

create table public.catalogue_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.catalogue_documents(id) on delete cascade,
  extractor_type text not null,
  extractor_version text not null,
  status public.catalogue_extraction_status not null default 'queued',
  raw_text text,
  extracted_data jsonb,
  confidence numeric(5,4),
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalogue_extractions_confidence_valid check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create index catalogue_extractions_document_idx
  on public.catalogue_extractions(document_id, created_at desc);

create table public.special_candidates (
  id uuid primary key default gen_random_uuid(),
  extraction_id uuid not null references public.catalogue_extractions(id) on delete cascade,
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  store_branch_id uuid references public.store_branches(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  title text,
  brand text,
  unit text,
  regular_price numeric(12,2),
  special_price numeric(12,2),
  currency char(3) not null default 'ZAR',
  starts_at timestamptz,
  ends_at timestamptz,
  source_url text,
  source_type text,
  confidence numeric(5,4),
  raw_payload jsonb not null default '{}'::jsonb,
  status public.special_candidate_status not null default 'pending',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_candidates_price_valid check (
    (regular_price is null or regular_price >= 0)
    and (special_price is null or special_price >= 0)
  ),
  constraint special_candidates_dates_valid check (
    starts_at is null or ends_at is null or ends_at > starts_at
  ),
  constraint special_candidates_confidence_valid check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create index special_candidates_extraction_idx
  on public.special_candidates(extraction_id, created_at desc);

create index special_candidates_review_idx
  on public.special_candidates(status, created_at desc);

alter table public.catalogue_documents enable row level security;
alter table public.catalogue_extractions enable row level security;
alter table public.special_candidates enable row level security;

revoke all on table public.catalogue_documents from anon, authenticated;
revoke all on table public.catalogue_extractions from anon, authenticated;
revoke all on table public.special_candidates from anon, authenticated;
