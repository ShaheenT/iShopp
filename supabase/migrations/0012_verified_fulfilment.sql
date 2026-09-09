-- Verified fulfilment terms are first-class commercial facts.
-- Retailer-wide rules use store_branch_id = NULL; branch rules override them.

create table public.fulfilment_rules (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  store_branch_id uuid,
  fulfilment_mode text not null default 'delivery',
  is_available boolean not null default true,
  delivery_fee numeric(12,2) not null default 0,
  minimum_order_value numeric(12,2),
  currency char(3) not null default 'ZAR',
  starts_at timestamptz not null,
  ends_at timestamptz,
  source_url text,
  source_type text not null,
  source_hash text,
  verification_status public.verification_status not null default 'pending',
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verification_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fulfilment_rules_mode_check check (fulfilment_mode in ('delivery', 'pickup', 'collection')),
  constraint fulfilment_rules_delivery_fee_check check (delivery_fee >= 0),
  constraint fulfilment_rules_minimum_order_check check (minimum_order_value is null or minimum_order_value >= 0),
  constraint fulfilment_rules_dates_check check (ends_at is null or ends_at > starts_at),
  constraint fulfilment_rules_source_required check (source_url is not null or source_hash is not null),
  constraint fulfilment_rules_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint fulfilment_rules_verified_at_check check (verification_status <> 'verified' or verified_at is not null)
);

-- Make the retailer/branch relationship part of the database contract.
create unique index store_branches_id_retailer_unique
  on public.store_branches(id, retailer_id);

alter table public.fulfilment_rules
  add constraint fulfilment_rules_branch_retailer_fk
  foreign key (store_branch_id, retailer_id)
  references public.store_branches(id, retailer_id)
  on delete cascade;

create index fulfilment_rules_scope_idx
  on public.fulfilment_rules(retailer_id, store_branch_id, fulfilment_mode, starts_at desc);

create index fulfilment_rules_effective_idx
  on public.fulfilment_rules(retailer_id, fulfilment_mode, verification_status, starts_at, ends_at);

create unique index fulfilment_rules_source_hash_unique
  on public.fulfilment_rules(retailer_id, store_branch_id, fulfilment_mode, source_hash)
  where source_hash is not null;

create table public.fulfilment_evidence (
  id uuid primary key default gen_random_uuid(),
  fulfilment_rule_id uuid not null references public.fulfilment_rules(id) on delete cascade,
  source_url text,
  source_type text not null,
  source_hash text,
  captured_at timestamptz not null default now(),
  status public.evidence_status not null default 'captured',
  extracted_text text,
  extracted_data jsonb,
  storage_path text,
  created_at timestamptz not null default now(),
  constraint fulfilment_evidence_source_required check (source_url is not null or storage_path is not null)
);

create unique index fulfilment_evidence_hash_unique
  on public.fulfilment_evidence(fulfilment_rule_id, source_hash)
  where source_hash is not null;

create index fulfilment_evidence_rule_idx
  on public.fulfilment_evidence(fulfilment_rule_id, captured_at desc);

create table public.fulfilment_verification_events (
  id uuid primary key default gen_random_uuid(),
  fulfilment_rule_id uuid not null references public.fulfilment_rules(id) on delete cascade,
  action public.verification_action not null,
  previous_status public.verification_status,
  new_status public.verification_status not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  reason text,
  evidence_id uuid references public.fulfilment_evidence(id) on delete set null,
  created_at timestamptz not null default now()
);

create index fulfilment_verification_events_rule_idx
  on public.fulfilment_verification_events(fulfilment_rule_id, created_at desc);

alter table public.fulfilment_rules enable row level security;
alter table public.fulfilment_evidence enable row level security;
alter table public.fulfilment_verification_events enable row level security;

revoke all on table public.fulfilment_rules from anon, authenticated;
revoke all on table public.fulfilment_evidence from anon, authenticated;
revoke all on table public.fulfilment_verification_events from anon, authenticated;

-- No two verified, available rules may overlap within the same scope/mode.
create extension if not exists btree_gist;
alter table public.fulfilment_rules
  add constraint fulfilment_rules_no_verified_overlap
  exclude using gist (
    retailer_id with =,
    coalesce(store_branch_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    fulfilment_mode with =,
    tstzrange(starts_at, coalesce(ends_at, 'infinity'::timestamptz), '[)') with &&
  ) where (verification_status = 'verified' and is_available = true);

-- A rule cannot become trusted without captured/processed evidence.
create or replace function public.require_fulfilment_evidence_for_verification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.verification_status = 'verified'
     and not exists (
       select 1
       from public.fulfilment_evidence fe
       where fe.fulfilment_rule_id = new.id
         and fe.status in ('captured', 'processed')
     ) then
    raise exception 'verified fulfilment rule requires evidence';
  end if;
  return new;
end;
$$;

create trigger fulfilment_rules_require_evidence
before insert or update of verification_status on public.fulfilment_rules
for each row execute function public.require_fulfilment_evidence_for_verification();

-- Keep updated_at correct without exposing a public write path.
create or replace function public.set_fulfilment_rules_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger fulfilment_rules_updated_at
before update on public.fulfilment_rules
for each row execute function public.set_fulfilment_rules_updated_at();

-- Return the currently effective verified delivery rule for each retailer/branch offer.
-- Branch-specific rules take precedence over retailer-wide rules.
create or replace function public.get_basket_fulfilment_inputs(p_basket_id uuid)
returns table (
  retailer_id uuid,
  branch_id uuid,
  fulfilment_rule_id uuid,
  fulfilment_mode text,
  is_available boolean,
  delivery_fee numeric,
  minimum_order_value numeric,
  currency char(3),
  starts_at timestamptz,
  ends_at timestamptz,
  evidence_id uuid,
  verified_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select distinct on (s.retailer_id, s.store_branch_id)
    s.retailer_id,
    s.store_branch_id,
    fr.id,
    fr.fulfilment_mode,
    fr.is_available,
    fr.delivery_fee,
    fr.minimum_order_value,
    fr.currency,
    fr.starts_at,
    fr.ends_at,
    fe.id,
    fr.verified_at
  from public.shopping_basket_items bi
  join public.shopping_baskets b on b.id = bi.basket_id and b.user_id = auth.uid()
  join public.products p on p.id = bi.product_id and p.verification_status = 'verified'
  join public.specials s on s.product_id = p.id
    and s.verification_status = 'verified'
    and s.starts_at <= now()
    and (s.ends_at is null or s.ends_at > now())
  join public.retailers r on r.id = s.retailer_id
    and r.status = 'active'
    and r.verification_status = 'verified'
  left join public.store_branches sb on sb.id = s.store_branch_id and sb.is_active = true
  join lateral (
    select fr0.*
    from public.fulfilment_rules fr0
    where fr0.retailer_id = s.retailer_id
      and (fr0.store_branch_id = s.store_branch_id or fr0.store_branch_id is null)
      and fr0.fulfilment_mode = 'delivery'
      and fr0.is_available = true
      and fr0.verification_status = 'verified'
      and fr0.starts_at <= now()
      and (fr0.ends_at is null or fr0.ends_at > now())
      and (s.store_branch_id is null or fr0.store_branch_id = s.store_branch_id or fr0.store_branch_id is null)
    order by (fr0.store_branch_id is not null) desc,
             fr0.starts_at desc,
             fr0.verified_at desc nulls last,
             fr0.id asc
    limit 1
  ) fr on true
  left join lateral (
    select fe0.id
    from public.fulfilment_evidence fe0
    where fe0.fulfilment_rule_id = fr.id
      and fe0.status in ('captured', 'processed')
    order by fe0.captured_at desc, fe0.id asc
    limit 1
  ) fe on true
  where b.id = p_basket_id
    and (s.store_branch_id is null or sb.id is not null)
  order by s.retailer_id, s.store_branch_id, fr.starts_at desc;
$$;

grant execute on function public.get_basket_fulfilment_inputs(uuid) to authenticated;
