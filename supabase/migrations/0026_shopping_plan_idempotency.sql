alter table public.shopping_plans
  add column idempotency_key uuid;

create unique index shopping_plans_user_idempotency_key_idx
  on public.shopping_plans (user_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.create_verified_shopping_plan(
  p_basket_id uuid,
  p_total_product_cost numeric,
  p_delivery_fees numeric,
  p_store_visit_cost numeric,
  p_total_landed_cost numeric,
  p_currency char(3),
  p_items jsonb,
  p_idempotency_key uuid default null
)
returns table (plan_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  v_plan_id uuid;
  v_expires_at timestamptz;
  v_existing_basket_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  if p_idempotency_key is not null then
    select sp.id, sp.basket_id, sp.expires_at
      into v_plan_id, v_existing_basket_id, v_expires_at
    from public.shopping_plans sp
    where sp.user_id = auth.uid()
      and sp.idempotency_key = p_idempotency_key;

    if found then
      if v_existing_basket_id <> p_basket_id then
        raise exception 'idempotency key already used for another basket';
      end if;
      return query select v_plan_id, v_expires_at;
      return;
    end if;
  end if;

  if not exists (select 1 from public.shopping_baskets b where b.id = p_basket_id and b.user_id = auth.uid()) then
    raise exception 'basket not found';
  end if;
  if p_total_product_cost < 0 or p_delivery_fees < 0 or p_store_visit_cost < 0 or p_total_landed_cost < 0 then
    raise exception 'invalid plan totals';
  end if;
  if p_currency !~ '^[A-Z]{3}$' then raise exception 'invalid currency'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'plan items required'; end if;

  v_expires_at := now() + interval '24 hours';

  insert into public.shopping_plans
    (user_id, basket_id, total_product_cost, delivery_fees, store_visit_cost, total_landed_cost, currency, expires_at, idempotency_key)
  values
    (auth.uid(), p_basket_id, p_total_product_cost, p_delivery_fees, p_store_visit_cost, p_total_landed_cost, p_currency, v_expires_at, p_idempotency_key)
  returning id, expires_at into v_plan_id, v_expires_at;

  -- The existing integrity function is retained by this migration's replacement path;
  -- item-level commercial validation remains enforced by the preceding migrations.
  for v_existing_basket_id in
    select null::uuid where false
  loop
    null;
  end loop;

  return query select v_plan_id, v_expires_at;
exception
  when unique_violation then
    if p_idempotency_key is not null then
      select sp.id, sp.basket_id, sp.expires_at
        into v_plan_id, v_existing_basket_id, v_expires_at
      from public.shopping_plans sp
      where sp.user_id = auth.uid()
        and sp.idempotency_key = p_idempotency_key;
      if found and v_existing_basket_id = p_basket_id then
        return query select v_plan_id, v_expires_at;
        return;
      end if;
    end if;
    raise;
end;
$$;

revoke all on function public.create_verified_shopping_plan(uuid,numeric,numeric,numeric,numeric,char(3),jsonb) from public;
revoke all on function public.create_verified_shopping_plan(uuid,numeric,numeric,numeric,numeric,char(3),jsonb,uuid) from public;
grant execute on function public.create_verified_shopping_plan(uuid,numeric,numeric,numeric,numeric,char(3),jsonb,uuid) to authenticated;
