create or replace function public.create_verified_shopping_plan(
p_basket_id uuid,p_total_product_cost numeric,p_delivery_fees numeric,p_store_visit_cost numeric,p_total_landed_cost numeric,p_currency char(3),p_items jsonb,p_idempotency_key uuid default null)
returns table(plan_id uuid,expires_at timestamptz) language plpgsql security definer set search_path=public as $$
declare v_plan_id uuid; v_expires_at timestamptz; v_existing_basket uuid; v_item jsonb; v_count int:=0; v_basket_count int; v_product_cost numeric:=0; v_delivery numeric:=0; v_product uuid; v_retailer uuid; v_branch uuid; v_special uuid; v_rule uuid; v_qty int; v_unit numeric; v_line numeric; v_curr char(3); v_price numeric; v_special_curr char(3); v_rule_curr char(3); v_fee numeric; v_min numeric; v_subtotal numeric; v_retailers int; v_store_cost numeric;
begin
if auth.uid() is null then raise exception 'authentication required'; end if;
if p_idempotency_key is not null then select id,basket_id,expires_at into v_plan_id,v_existing_basket,v_expires_at from public.shopping_plans where user_id=auth.uid() and idempotency_key=p_idempotency_key; if found then if v_existing_basket<>p_basket_id then raise exception 'idempotency key already used for another basket'; end if; return query select v_plan_id,v_expires_at; return; end if; end if;
if not exists(select 1 from public.shopping_baskets where id=p_basket_id and user_id=auth.uid()) then raise exception 'basket not found'; end if;
if p_total_product_cost<0 or p_delivery_fees<0 or p_store_visit_cost<0 or p_total_landed_cost<0 then raise exception 'invalid plan totals'; end if;
if p_currency !~ '^[A-Z]{3}$' or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'invalid plan input'; end if;
select count(*) into v_basket_count from public.shopping_basket_items where basket_id=p_basket_id;
if jsonb_array_length(p_items)<>v_basket_count then raise exception 'plan items do not match basket'; end if;
if exists(select 1 from(select value->>'productId' product_id,count(*) n from jsonb_array_elements(p_items) group by value->>'productId') d where n>1) then raise exception 'duplicate basket product in plan'; end if;
v_expires_at:=now()+interval '24 hours';
insert into public.shopping_plans(user_id,basket_id,total_product_cost,delivery_fees,store_visit_cost,total_landed_cost,currency,expires_at,idempotency_key) values(auth.uid(),p_basket_id,p_total_product_cost,p_delivery_fees,p_store_visit_cost,p_total_landed_cost,p_currency,v_expires_at,p_idempotency_key) returning id into v_plan_id;
for v_item in select value from jsonb_array_elements(p_items) loop
v_count:=v_count+1; v_product:=(v_item->>'productId')::uuid; v_retailer:=(v_item->>'retailerId')::uuid; v_branch:=nullif(v_item->>'branchId','')::uuid; v_special:=(v_item->>'specialId')::uuid; v_rule:=(v_item->>'fulfilmentRuleId')::uuid; v_qty:=(v_item->>'quantity')::int; v_unit:=(v_item->>'unitPrice')::numeric; v_line:=(v_item->>'lineTotal')::numeric; v_curr:=(v_item->>'currency')::char(3);
if not exists(select 1 from public.shopping_basket_items where basket_id=p_basket_id and product_id=v_product and quantity=v_qty) then raise exception 'plan item does not match basket quantity'; end if;
if v_qty is null or v_qty<=0 or v_unit is null or v_unit<0 or v_line is null or v_line<0 or round(v_qty*v_unit,2)<>v_line then raise exception 'line total mismatch'; end if;
if v_curr<>p_currency then raise exception 'mixed plan currencies'; end if;
select s.special_price,s.currency into v_price,v_special_curr from public.specials s join public.products p on p.id=s.product_id and p.verification_status='verified' join public.retailers r on r.id=s.retailer_id and r.status='active' and r.verification_status='verified' left join public.store_branches sb on sb.id=s.store_branch_id where s.id=v_special and s.product_id=v_product and s.retailer_id=v_retailer and s.verification_status='verified' and s.starts_at<=now() and(s.ends_at is null or s.ends_at>now()) and((s.store_branch_id is null and v_branch is null) or s.store_branch_id=v_branch) and(s.store_branch_id is null or(sb.retailer_id=s.retailer_id and sb.is_active));
if not found then raise exception 'verified special unavailable'; end if; if v_price<>v_unit or v_special_curr<>v_curr then raise exception 'plan price mismatch'; end if;
select fr.currency,fr.delivery_fee,fr.minimum_order_value into v_rule_curr,v_fee,v_min from public.fulfilment_rules fr where fr.id=v_rule and fr.retailer_id=v_retailer and((fr.store_branch_id is null and v_branch is null) or fr.store_branch_id=v_branch) and fr.fulfilment_mode='delivery' and fr.is_available and fr.verification_status='verified' and fr.starts_at<=now() and(fr.ends_at is null or fr.ends_at>now()) and exists(select 1 from public.fulfilment_evidence fe where fe.fulfilment_rule_id=fr.id and fe.status in('captured','processed'));
if not found then raise exception 'verified fulfilment rule unavailable'; end if; if v_rule_curr<>v_curr then raise exception 'fulfilment currency mismatch'; end if;
v_product_cost:=v_product_cost+v_line;
insert into public.shopping_plan_items(plan_id,product_id,retailer_id,store_branch_id,special_id,fulfilment_rule_id,quantity,unit_price,line_total,currency) values(v_plan_id,v_product,v_retailer,v_branch,v_special,v_rule,v_qty,v_unit,v_line,v_curr);
end loop;
if v_count<>v_basket_count then raise exception 'plan item count mismatch'; end if; if round(v_product_cost,2)<>round(p_total_product_cost,2) then raise exception 'product cost mismatch'; end if;
select count(distinct retailer_id) into v_retailers from public.shopping_plan_items where plan_id=v_plan_id; v_store_cost:=round(v_retailers*p_store_visit_cost,2);
for v_retailer,v_branch,v_fee,v_min in select spi.retailer_id,spi.store_branch_id,fr.delivery_fee,coalesce(fr.minimum_order_value,0) from public.shopping_plan_items spi join public.fulfilment_rules fr on fr.id=spi.fulfilment_rule_id where spi.plan_id=v_plan_id group by spi.retailer_id,spi.store_branch_id,fr.delivery_fee,fr.minimum_order_value loop
select round(sum(line_total),2) into v_subtotal from public.shopping_plan_items where plan_id=v_plan_id and retailer_id=v_retailer and((store_branch_id is null and v_branch is null) or store_branch_id=v_branch); if v_subtotal<v_min then raise exception 'minimum order constraint not met'; end if; v_delivery:=v_delivery+v_fee; end loop;
if round(v_delivery,2)<>round(p_delivery_fees,2) then raise exception 'delivery fee mismatch'; end if; if round(v_product_cost+v_delivery+v_store_cost,2)<>round(p_total_landed_cost,2) then raise exception 'landed cost mismatch'; end if;
return query select v_plan_id,v_expires_at;
exception when unique_violation then if p_idempotency_key is not null then select id,basket_id,expires_at into v_plan_id,v_existing_basket,v_expires_at from public.shopping_plans where user_id=auth.uid() and idempotency_key=p_idempotency_key; if found and v_existing_basket=p_basket_id then return query select v_plan_id,v_expires_at; return; end if; end if; raise;
end; $$;
revoke all on function public.create_verified_shopping_plan(uuid,numeric,numeric,numeric,numeric,char(3),jsonb) from public;
revoke all on function public.create_verified_shopping_plan(uuid,numeric,numeric,numeric,numeric,char(3),jsonb,uuid) from public;
grant execute on function public.create_verified_shopping_plan(uuid,numeric,numeric,numeric,numeric,char(3),jsonb,uuid) to authenticated;
