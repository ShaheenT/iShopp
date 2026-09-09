create table public.shopping_baskets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Basket',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shopping_basket_items (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references public.shopping_baskets(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopping_basket_items_quantity_positive check (quantity > 0),
  unique (basket_id, product_id)
);

create index shopping_baskets_user_idx on public.shopping_baskets(user_id);
create index shopping_basket_items_basket_idx on public.shopping_basket_items(basket_id);
create index shopping_basket_items_product_idx on public.shopping_basket_items(product_id);

alter table public.shopping_baskets enable row level security;
alter table public.shopping_basket_items enable row level security;

create policy "shopping_baskets_owner_read"
  on public.shopping_baskets for select to authenticated
  using (auth.uid() = user_id);
create policy "shopping_baskets_owner_insert"
  on public.shopping_baskets for insert to authenticated
  with check (auth.uid() = user_id);
create policy "shopping_baskets_owner_update"
  on public.shopping_baskets for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "shopping_baskets_owner_delete"
  on public.shopping_baskets for delete to authenticated
  using (auth.uid() = user_id);

create policy "shopping_basket_items_owner_read"
  on public.shopping_basket_items for select to authenticated
  using (exists (select 1 from public.shopping_baskets b where b.id = basket_id and b.user_id = auth.uid()));
create policy "shopping_basket_items_owner_insert"
  on public.shopping_basket_items for insert to authenticated
  with check (exists (select 1 from public.shopping_baskets b where b.id = basket_id and b.user_id = auth.uid()));
create policy "shopping_basket_items_owner_update"
  on public.shopping_basket_items for update to authenticated
  using (exists (select 1 from public.shopping_baskets b where b.id = basket_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.shopping_baskets b where b.id = basket_id and b.user_id = auth.uid()));
create policy "shopping_basket_items_owner_delete"
  on public.shopping_basket_items for delete to authenticated
  using (exists (select 1 from public.shopping_baskets b where b.id = basket_id and b.user_id = auth.uid()));

create or replace function public.get_basket_intelligence_inputs(p_basket_id uuid)
returns table (
  product_id uuid,
  quantity integer,
  retailer_id uuid,
  retailer_name text,
  branch_id uuid,
  branch_name text,
  special_id uuid,
  special_price numeric,
  currency char(3)
)
language sql
security definer
set search_path = public
as $$
  select
    bi.product_id,
    bi.quantity,
    r.id,
    r.name,
    sb.id,
    sb.name,
    s.id,
    s.special_price,
    s.currency
  from public.shopping_basket_items bi
  join public.shopping_baskets b on b.id = bi.basket_id
  join public.products p on p.id = bi.product_id and p.verification_status = 'verified'
  join public.specials s on s.product_id = p.id
    and s.verification_status = 'verified'
    and s.starts_at <= now()
    and (s.ends_at is null or s.ends_at > now())
  join public.retailers r on r.id = s.retailer_id
    and r.status = 'active'
    and r.verification_status = 'verified'
  left join public.store_branches sb on sb.id = s.store_branch_id and sb.is_active = true
  where b.id = p_basket_id
    and b.user_id = auth.uid()
  order by bi.product_id, s.special_price asc, r.name asc, s.id asc;
$$;

grant execute on function public.get_basket_intelligence_inputs(uuid) to authenticated;
