create or replace function public.verify_special(
  p_special_id uuid,
  p_action public.verification_action,
  p_evidence_id uuid default null,
  p_actor_user_id uuid default null,
  p_reason text default null
)
returns public.specials
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_special public.specials;
  v_evidence public.special_evidence;
  v_previous_status public.verification_status;
  v_next_status public.verification_status;
begin
  select * into v_special
  from public.specials
  where id = p_special_id
  for update;

  if not found then
    raise exception 'special_not_found' using errcode = 'P0002';
  end if;

  v_previous_status := v_special.verification_status;

  if v_previous_status = 'verified' then
    raise exception 'special_already_verified' using errcode = 'P0003';
  end if;

  if p_action = 'verified' then
    if p_evidence_id is null then
      raise exception 'evidence_required_for_verification' using errcode = 'P0004';
    end if;

    select * into v_evidence
    from public.special_evidence
    where id = p_evidence_id
      and special_id = p_special_id;

    if not found then
      raise exception 'evidence_not_found' using errcode = 'P0005';
    end if;

    if v_evidence.status = 'failed' then
      raise exception 'invalid_evidence' using errcode = 'P0006';
    end if;

    v_next_status := 'verified';
  else
    v_next_status := 'rejected';
  end if;

  update public.specials
  set verification_status = v_next_status,
      verified_at = case when p_action = 'verified' then now() else null end,
      updated_at = now()
  where id = p_special_id
  returning * into v_special;

  insert into public.special_verification_events (
    special_id,
    action,
    previous_status,
    new_status,
    actor_user_id,
    reason,
    evidence_id
  ) values (
    p_special_id,
    p_action,
    v_previous_status,
    v_next_status,
    p_actor_user_id,
    p_reason,
    p_evidence_id
  );

  return v_special;
end;
$$;

revoke all on function public.verify_special(uuid, public.verification_action, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.verify_special(uuid, public.verification_action, uuid, uuid, text) to service_role;
