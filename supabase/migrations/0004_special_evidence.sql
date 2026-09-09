create type public.evidence_status as enum ('captured', 'processed', 'failed');
create type public.verification_action as enum ('submitted', 'verified', 'rejected');

create table public.special_evidence (
  id uuid primary key default gen_random_uuid(),
  special_id uuid not null references public.specials(id) on delete cascade,
  source_url text,
  source_type text not null,
  source_hash text,
  captured_at timestamptz not null default now(),
  status public.evidence_status not null default 'captured',
  extracted_text text,
  extracted_data jsonb,
  storage_path text,
  created_at timestamptz not null default now(),
  constraint special_evidence_source_required check (
    source_url is not null or storage_path is not null
  )
);

create unique index special_evidence_hash_unique
  on public.special_evidence(special_id, source_hash)
  where source_hash is not null;

create index special_evidence_special_idx
  on public.special_evidence(special_id, captured_at desc);

create table public.special_verification_events (
  id uuid primary key default gen_random_uuid(),
  special_id uuid not null references public.specials(id) on delete cascade,
  action public.verification_action not null,
  previous_status public.verification_status,
  new_status public.verification_status not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  reason text,
  evidence_id uuid references public.special_evidence(id) on delete set null,
  created_at timestamptz not null default now()
);

create index special_verification_events_special_idx
  on public.special_verification_events(special_id, created_at desc);

alter table public.special_evidence enable row level security;
alter table public.special_verification_events enable row level security;

revoke all on table public.special_evidence from anon, authenticated;
revoke all on table public.special_verification_events from anon, authenticated;
