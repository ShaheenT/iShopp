-- Production hardening: make shopping-plan creation retry-safe and ensure
-- community evidence storage paths cannot be supplied across user boundaries.

alter table public.shopping_plans
  add column if not exists idempotency_key uuid;

create unique index if not exists shopping_plans_user_idempotency_unique
  on public.shopping_plans(user_id, idempotency_key)
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
  v_expires_at timestamptz := now() + interval '24 hours';
  v_existing_basket_id uuid;
  v_item jsonb;
  v_item_count integer := 0;
  v_basket_item_count integer;
  v_expected_product_cost numeric := 0;
  v_expected_delivery numeric := 0;
  v_product_id uuid;
  v_retailer_id uuid;
  v_branch_id uuid;
  v_special_id uuid;
  v_rule_id uuid;
  v_quantity integer;
  v_unit_price numeric;
  v_line_total numeric;
  v_currency char(3);
  v_verified_price numeric;
  v_special_currency char(3);
  v_rule_currency char(3);
  v_delivery_fee numeric;
  v_minimum_order numeric;
  v_scope_subtotal numeric;
  v_retailer_count integer;
  v_store_cost numeric;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  if p_idempotency_key is not null then
    select sp.id, sp.basket_id, sp.expires_at
      into v_plan_id, v_existing_basket_id, v_expires_at
    from public.shopping_plans sp
    where sp.user_id = auth.uid() and sp.idempotency_key = p_idempotency_key
    limit 1;

    if found then
      if v_existing_basket_id <> p_basket_id then
        raise exception 'idempotency key already used for another basket';
      end if;
      return query select v_plan_id, v_expires_at;
      return;
    end if;
  end if;

  if not exists (
    select 1 from public.shopping_baskets b
    where b.id = p_basket_id and b.user_id = auth.uid()
  ) then raise exception 'basket not found'; end if;

  if p_total_product_cost < 0 or p_delivery_fees < 0 or p_store_visit_cost < 0 or p_total_landed_cost < 0 then
    raise exception 'invalid plan totals';
  end if;
  if p_currency !~ '^[A-Z]{3}$' then raise exception 'invalid currency'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'plan items required'; end if;

  select count(*) into v_basket_item_count
  from public.shopping_basket_items bi
  where bi.basket_id = p_basket_id;

  if jsonb_array_length(p_items) <> v_basket_item_count then
    raise exception 'plan items do not match basket';
  end if;

  if exists (
    select 1
    from (
      select value->>'productId' as product_id, count(*) as item_count
      from jsonb_array_elements(p_items)
      group by value->>'productId'
    ) duplicates
    where duplicates.item_count > 1
  ) then
    raise exception 'duplicate basket product in plan';
  end if;

  insert into public.shopping_plans
    (user_id, basket_id, total_product_cost, delivery_fees, store_visit_cost, total_landed_cost, currency, expires_at, idempotency_key)
  values
    (auth.uid(), p_basket_id, p_total_product_cost, p_delivery_fees, p_store_visit_cost, p_total_landed_cost, p_currency, v_expires_at, p_idempotency_key)
  returning id into v_plan_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_item_count := v_item_count + 1;
    v_product_id := (v_item->>'productId')::uuid;
    v_retailer_id := (v_item->>'retailerId')::uuid;
    v_branch_id := nullif(v_item->>'branchId', '')::uuid;
    v_special_id := (v_item->>'specialId')::uuid;
    v_rule_id := (v_item->>'fulfilmentRuleId')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unitPrice')::numeric;
    v_line_total := (v_item->>'lineTotal')::numeric;
    v_currency := (v_item->>'currency')::char(3);

    if not exists (
      select 1 from public.shopping_basket_items bi
      where bi.basket_id = p_basket_id
        and bi.product_id = v_product_id
        and bi.quantity = v_quantity
    ) then
      raise exception 'plan item does not match basket quantity';
    end if;

    if v_quantity is null or v_quantity <= 0 or v_unit_price is null or v_unit_price < 0 then
      raise exception 'invalid plan item';
    end if;
    if v_line_total is null or v_line_total < 0 or round(v_quantity * v_unit_price, 2) <> v_line_total then
      raise exception 'line total mismatch';
    end if;
    if v_currency <> p_currency then raise exception 'mixed plan currencies'; end if;

    select s.special_price, s.currency into v_verified_price, v_special_currency
    from public.specials s
    join public.products p on p.id = s.product_id and p.verification_status = 'verified'
    join public.retailers r on r.id = s.retailer_id and r.status = 'active' and r.verification_status = 'verified'
    left join public.store_branches sb on sb.id = s.store_branch_id
    where s.id = v_special_id
      and s.product_id = v_product_id
      and s.retailer_id = v_retailer_id
      and s.verification_status = 'verified'
      and s.starts_at <= now() and (s.ends_at is null or s.ends_at > now())
      and ((s.store_branch_id is null and v_branch_id is null) or s.store_branch_id = v_branch_id)
      and (s.store_branch_id is null or (sb.retailer_id = s.retailer_id and sb.is_active));
    if not found then raise exception 'verified special unavailable'; end if;
    if v_verified_price <> v_unit_price or v_special_currency <> v_currency then raise exception 'plan price mismatch'; end if;

    select fr.currency, fr.delivery_fee, fr.minimum_order_value into v_rule_currency, v_delivery_fee, v_minimum_order
    from public.fulfilment_rules fr
    where fr.id = v_rule_id
      and fr.retailer_id = v_retailer_id
      and ((fr.store_branch_id is null and v_branch_id is null) or fr.store_branch_id = v_branch_id)
      and fr.fulfilment_mode = 'delivery'
      and fr.is_available
      and fr.verification_status = 'verified'
      and fr.starts_at <= now() and (fr.ends_at is null or fr.ends_at > now())
      and exists (
        select 1 from public.fulfilment_evidence fe
        where fe.fulfilment_rule_id = fr.id and fe.status in ('captured','processed')
      );
    if not found then raise exception 'verified fulfilment rule unavailable'; end if;
    if v_rule_currency <> v_currency then raise exception 'fulfilment currency mismatch'; end if;

    v_expected_product_cost := v_expected_product_cost + v_line_total;

    insert into public.shopping_plan_items
      (plan_id, product_id, retailer_id, store_branch_id, special_id, fulfilment_rule_id, quantity, unit_price, line_total, currency)
    values
      (v_plan_id, v_product_id, v_retailer_id, v_branch_id, v_special_id, v_rule_id, v_quantity, v_unit_price, v_line_total, v_currency);
  end loop;

  if v_item_count <> v_basket_item_count then raise exception 'plan item count mismatch'; end if;
  if v_expected_product_cost <> round(v_expected_product_cost, 2) then raise exception 'invalid product precision'; end if;
  if round(v_expected_product_cost, 2) <> round(p_total_product_cost, 2) then raise exception 'product cost mismatch'; end if;

  select count(distinct retailer_id) into v_retailer_count
  from public.shopping_plan_items where plan_id = v_plan_id;
  v_store_cost := round(v_retailer_count * p_store_visit_cost, 2);

  for v_retailer_id, v_branch_id, v_delivery_fee, v_minimum_order in
    select spi.retailer_id, spi.store_branch_id, fr.delivery_fee, coalesce(fr.minimum_order_value, 0)
    from public.shopping_plan_items spi
    join public.fulfilment_rules fr on fr.id = spi.fulfilment_rule_id
    where spi.plan_id = v_plan_id
    group by spi.retailer_id, spi.store_branch_id, fr.delivery_fee, fr.minimum_order_value
  loop
    select round(sum(line_total), 2) into v_scope_subtotal
    from public.shopping_plan_items
    where plan_id = v_plan_id
      and retailer_id = v_retailer_id
      and ((store_branch_id is null and v_branch_id is null) or store_branch_id = v_branch_id);

    if v_scope_subtotal < v_minimum_order then raise exception 'minimum order constraint not met'; end if;
    v_expected_delivery := v_expected_delivery + v_delivery_fee;
  end loop;

  if round(v_expected_delivery, 2) <> round(p_delivery_fees, 2) then raise exception 'delivery fee mismatch'; end if;
  if round(v_expected_product_cost + v_expected_delivery + v_store_cost, 2) <> round(p_total_landed_cost, 2) then
    raise exception 'landed cost mismatch';
  end if;

  return query select v_plan_id, v_expires_at;
exception
  when unique_violation then
    if p_idempotency_key is null then raise; end if;
    select sp.id, sp.basket_id, sp.expires_at
      into v_plan_id, v_existing_basket_id, v_expires_at
    from public.shopping_plans sp
    where sp.user_id = auth.uid() and sp.idempotency_key = p_idempotency_key
    limit 1;
    if not found then raise; end if;
    if v_existing_basket_id <> p_basket_id then raise exception 'idempotency key already used for another basket'; end if;
    return query select v_plan_id, v_expires_at;
end;
$$;

revoke all on function public.create_verified_shopping_plan(uuid,numeric,numeric,numeric,numeric,char(3),jsonb) from public;
revoke all on function public.create_verified_shopping_plan(uuid,numeric,numeric,numeric,numeric,char(3),jsonb,uuid) from public;
grant execute on function public.create_verified_shopping_plan(uuid,numeric,numeric,numeric,numeric,char(3),jsonb,uuid) to authenticated;

-- A stored evidence path is only valid inside the submitting user's private
-- storage namespace. External source URLs remain allowed but are not fetched
-- server-side by this contribution path.
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

  if p_evidence_storage_path is not null and (
    split_part(p_evidence_storage_path, '/', 1) <> auth.uid()::text
    or p_evidence_storage_path !~ ('^' || auth.uid()::text || '/[^/]+$')
  ) then
    raise exception 'evidence storage path outside user scope';
  end if;

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

grant execute on function public.submit_community_price(uuid,uuid,uuid,numeric,numeric,char(3),timestamptz,text,text,text,text,text,text,jsonb,uuid) to authenticated;
