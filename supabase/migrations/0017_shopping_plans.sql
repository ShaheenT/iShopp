create table public.shopping_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  basket_id uuid not null references public.shopping_baskets(id) on delete cascade,
  total_product_cost numeric(12,2) not null check (total_product_cost >= 0),
  delivery_fees numeric(12,2) not null default 0 check (delivery_fees >= 0),
  store_visit_cost numeric(12,2) not null default 0 check (store_visit_cost >= 0),
  total_landed_cost numeric(12,2) not null check (total_landed_cost >= 0),
  currency char(3) not null,
  status text not null default 'active' check (status in ('active','expired','completed','cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create table public.shopping_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.shopping_plans(id) on delete cascade,
  product_id uuid not null references public.products(id),
  retailer_id uuid not null references public.retailers(id),
  store_branch_id uuid,
  special_id uuid not null references public.specials(id),
  fulfilment_rule_id uuid not null references public.fulfilment_rules(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  currency char(3) not null,
  created_at timestamptz not null default now()
);

alter table public.shopping_plans enable row level security;
alter table public.shopping_plan_items enable row level security;

create policy shopping_plans_owner_select on public.shopping_plans
for select to authenticated using (user_id = auth.uid());
create policy shopping_plan_items_owner_select on public.shopping_plan_items
for select to authenticated using (exists (
  select 1 from public.shopping_plans p where p.id = plan_id and p.user_id = auth.uid()
));

revoke insert, update, delete on public.shopping_plans from authenticated;
revoke insert, update, delete on public.shopping_plan_items from authenticated;

grant select on public.shopping_plans, public.shopping_plan_items to authenticated;

create or replace function public.create_verified_shopping_plan(
  p_basket_id uuid,
  p_total_product_cost numeric,
  p_delivery_fees numeric,
  p_store_visit_cost numeric,
  p_total_landed_cost numeric,
  p_currency char(3),
  p_items jsonb
)
returns table (plan_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  v_plan_id uuid;
  v_expires_at timestamptz := now() + interval '24 hours';
  v_item jsonb;
  v_item_count integer := 0;
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
  v_rule_currency char(3);
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.shopping_baskets b where b.id = p_basket_id and b.user_id = auth.uid()) then
    raise exception 'basket not found';
  end if;
  if p_total_product_cost < 0 or p_delivery_fees < 0 or p_store_visit_cost < 0 or p_total_landed_cost < 0 then
    raise exception 'invalid plan totals';
  end if;
  if p_currency !~ '^[A-Z]{3}$' then raise exception 'invalid currency'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'plan items required'; end if;

  insert into public.shopping_plans
    (user_id, basket_id, total_product_cost, delivery_fees, store_visit_cost, total_landed_cost, currency, expires_at)
  values
    (auth.uid(), p_basket_id, p_total_product_cost, p_delivery_fees, p_store_visit_cost, p_total_landed_cost, p_currency, v_expires_at)
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

    select s.special_price, s.currency into v_verified_price, v_rule_currency
    from public.specials s
    join public.products p on p.id = s.product_id and p.verification_status = 'verified'
    join public.retailers r on r.id = s.retailer_id and r.status = 'active' and r.verification_status = 'verified'
    where s.id = v_special_id
      and s.product_id = v_product_id
      and s.retailer_id = v_retailer_id
      and s.verification_status = 'verified'
      and s.starts_at <= now() and (s.ends_at is null or s.ends_at > now());
    if not found then raise exception 'verified special unavailable'; end if;
    if v_verified_price <> v_unit_price or v_rule_currency <> v_currency then raise exception 'plan price mismatch'; end if;

    if not exists (
      select 1 from public.fulfilment_rules fr
      where fr.id = v_rule_id and fr.retailer_id = v_retailer_id
        and (fr.store_branch_id is null and v_branch_id is null or fr.store_branch_id = v_branch_id)
        and fr.fulfilment_mode = 'delivery' and fr.is_available
        and fr.verification_status = 'verified'
        and fr.starts_at <= now() and (fr.ends_at is null or fr.ends_at > now())
        and exists (select 1 from public.fulfilment_evidence fe where fe.fulfilment_rule_id = fr.id and fe.status in ('captured','processed'))
    ) then raise exception 'verified fulfilment rule unavailable'; end if;
    if v_quantity <= 0 or v_unit_price < 0 or v_line_total < 0 then raise exception 'invalid plan item'; end if;

    insert into public.shopping_plan_items
      (plan_id, product_id, retailer_id, store_branch_id, special_id, fulfilment_rule_id, quantity, unit_price, line_total, currency)
    values
      (v_plan_id, v_product_id, v_retailer_id, v_branch_id, v_special_id, v_rule_id, v_quantity, v_unit_price, v_line_total, v_currency);
  end loop;

  return query select v_plan_id, v_expires_at;
end;
$$;

grant execute on function public.create_verified_shopping_plan(uuid,numeric,numeric,numeric,numeric,char(3),jsonb) to authenticated;
