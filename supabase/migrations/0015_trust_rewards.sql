-- Trust is derived from verified outcomes. Rewards are ledger entries, not mutable balances.

create table public.community_trust_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  verified_submission_count integer not null default 0 check (verified_submission_count >= 0),
  rejected_submission_count integer not null default 0 check (rejected_submission_count >= 0),
  verification_accuracy numeric(5,2) not null default 0 check (verification_accuracy between 0 and 100),
  trust_score numeric(6,2) not null default 0 check (trust_score between 0 and 100),
  trust_level text not null default 'new' check (trust_level in ('new','contributor','trusted','expert')),
  updated_at timestamptz not null default now()
);

create table public.community_reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id uuid not null references public.community_price_submissions(id) on delete cascade,
  points integer not null check (points > 0),
  reason text not null,
  created_at timestamptz not null default now(),
  constraint community_reward_once_per_submission unique (submission_id)
);

create index community_reward_user_idx on public.community_reward_ledger(user_id, created_at desc);

alter table public.community_trust_profiles enable row level security;
alter table public.community_reward_ledger enable row level security;

create policy community_trust_self_select
on public.community_trust_profiles
for select to authenticated
using (user_id = auth.uid());

create policy community_rewards_self_select
on public.community_reward_ledger
for select to authenticated
using (user_id = auth.uid());

revoke insert, update, delete on table public.community_trust_profiles from anon, authenticated;
revoke insert, update, delete on table public.community_reward_ledger from anon, authenticated;

grant select on table public.community_trust_profiles to authenticated;
grant select on table public.community_reward_ledger to authenticated;

create or replace function public.recalculate_community_trust(p_user_id uuid)
returns public.community_trust_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verified integer;
  v_rejected integer;
  v_total integer;
  v_accuracy numeric(5,2);
  v_score numeric(6,2);
  v_level text;
  v_profile public.community_trust_profiles;
begin
  select
    count(*) filter (where verification_status = 'verified')::integer,
    count(*) filter (where verification_status = 'rejected')::integer
  into v_verified, v_rejected
  from public.community_price_submissions
  where user_id = p_user_id;

  v_total := v_verified + v_rejected;
  v_accuracy := case when v_total = 0 then 0 else round((v_verified::numeric / v_total::numeric) * 100, 2) end;
  v_score := least(100, round((least(v_verified, 20)::numeric * 2) + (v_accuracy * 0.6), 2));
  v_level := case
    when v_score >= 85 then 'expert'
    when v_score >= 60 then 'trusted'
    when v_score >= 20 then 'contributor'
    else 'new'
  end;

  insert into public.community_trust_profiles (
    user_id, verified_submission_count, rejected_submission_count,
    verification_accuracy, trust_score, trust_level, updated_at
  ) values (
    p_user_id, v_verified, v_rejected, v_accuracy, v_score, v_level, now()
  )
  on conflict (user_id) do update set
    verified_submission_count = excluded.verified_submission_count,
    rejected_submission_count = excluded.rejected_submission_count,
    verification_accuracy = excluded.verification_accuracy,
    trust_score = excluded.trust_score,
    trust_level = excluded.trust_level,
    updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.recalculate_community_trust(uuid) from public;
grant execute on function public.recalculate_community_trust(uuid) to authenticated;

create or replace function public.get_community_reward_summary()
returns table (points integer, verified_contributions integer, trust_score numeric, trust_level text)
language sql
security definer
set search_path = public
as $$
  select
    coalesce((select sum(points)::integer from public.community_reward_ledger where user_id = auth.uid()), 0),
    coalesce((select verified_submission_count from public.community_trust_profiles where user_id = auth.uid()), 0),
    coalesce((select trust_score from public.community_trust_profiles where user_id = auth.uid()), 0),
    coalesce((select trust_level from public.community_trust_profiles where user_id = auth.uid()), 'new');
$$;

grant execute on function public.get_community_reward_summary() to authenticated;

create or replace function public.verify_community_price(
  p_submission_id uuid,
  p_reason text
)
returns table (submission_id uuid, verification_status public.verification_status, verified_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  v_previous public.verification_status;
  v_submitter uuid;
  v_evidence_id uuid;
  v_verified_at timestamptz := now();
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.community_price_verifiers v where v.user_id = auth.uid() and v.is_active) then
    raise exception 'community price verification access denied';
  end if;

  select verification_status, user_id into v_previous, v_submitter
  from public.community_price_submissions where id = p_submission_id for update;
  if not found then raise exception 'community price submission not found'; end if;
  if v_previous <> 'pending' then raise exception 'only pending community prices can be verified'; end if;
  if v_submitter = auth.uid() then raise exception 'self verification is not allowed'; end if;

  select e.id into v_evidence_id
  from public.community_price_evidence e
  where e.submission_id = p_submission_id
    and e.status in ('captured', 'processed')
    and (e.source_url is not null or e.storage_path is not null)
  order by e.captured_at desc, e.id asc limit 1;
  if v_evidence_id is null then raise exception 'usable evidence required before verification'; end if;

  update public.community_price_submissions
  set verification_status = 'verified', verified_at = v_verified_at,
      verified_by = auth.uid(), verification_reason = p_reason
  where id = p_submission_id;

  insert into public.community_price_verification_events
    (submission_id, action, previous_status, new_status, actor_user_id, reason, evidence_id)
  values (p_submission_id, 'verified', v_previous, 'verified', auth.uid(), p_reason, v_evidence_id);

  insert into public.community_reward_ledger (user_id, submission_id, points, reason)
  values (v_submitter, p_submission_id, 10, 'Verified community price contribution')
  on conflict (submission_id) do nothing;

  perform public.recalculate_community_trust(v_submitter);
  return query select p_submission_id, 'verified'::public.verification_status, v_verified_at;
end;
$$;

grant execute on function public.verify_community_price(uuid, text) to authenticated;

create or replace function public.reject_community_price(
  p_submission_id uuid,
  p_reason text
)
returns table (submission_id uuid, verification_status public.verification_status)
language plpgsql security definer set search_path = public
as $$
declare
  v_previous public.verification_status;
  v_submitter uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.community_price_verifiers v where v.user_id = auth.uid() and v.is_active) then
    raise exception 'community price verification access denied';
  end if;

  select verification_status, user_id into v_previous, v_submitter
  from public.community_price_submissions where id = p_submission_id for update;
  if not found then raise exception 'community price submission not found'; end if;
  if v_previous <> 'pending' then raise exception 'only pending community prices can be rejected'; end if;
  if v_submitter = auth.uid() then raise exception 'self rejection is not allowed'; end if;

  update public.community_price_submissions
  set verification_status = 'rejected', verified_at = now(),
      verified_by = auth.uid(), verification_reason = p_reason
  where id = p_submission_id;

  insert into public.community_price_verification_events
    (submission_id, action, previous_status, new_status, actor_user_id, reason)
  values (p_submission_id, 'rejected', v_previous, 'rejected', auth.uid(), p_reason);

  perform public.recalculate_community_trust(v_submitter);
  return query select p_submission_id, 'rejected'::public.verification_status;
end;
$$;

grant execute on function public.reject_community_price(uuid, text) to authenticated;
