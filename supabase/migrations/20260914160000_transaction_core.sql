create table if not exists public.baskets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  retailer_id uuid references public.retailers(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  status text not null default 'open' check (status in ('open','locked','checked_out','abandoned')),
  currency text not null default 'ZAR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.basket_items (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references public.baskets(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  special_id uuid references public.specials(id) on delete set null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) check (unit_price is null or unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (basket_id, product_id, special_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  basket_id uuid references public.baskets(id) on delete set null,
  retailer_id uuid references public.retailers(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  status text not null default 'pending_payment' check (status in ('pending_payment','paid','processing','ready','fulfilled','cancelled','refunded')),
  currency text not null default 'ZAR',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  special_id uuid references public.specials(id) on delete set null,
  product_name text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  provider text not null,
  provider_reference text,
  event_type text not null,
  status text not null,
  amount numeric(12,2),
  currency text not null default 'ZAR',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.fulfilments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  method text not null default 'collection' check (method in ('collection','delivery')),
  status text not null default 'pending' check (status in ('pending','accepted','preparing','ready','out_for_delivery','completed','cancelled')),
  address jsonb,
  tracking_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commission_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  commission_rate numeric(7,4) not null check (commission_rate >= 0 and commission_rate <= 1),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  merchant_amount numeric(12,2) not null check (merchant_amount >= 0),
  currency text not null default 'ZAR',
  status text not null default 'pending' check (status in ('pending','payable','paid','reversed')),
  created_at timestamptz not null default now()
);

create index if not exists baskets_user_status_idx on public.baskets(user_id,status);
create index if not exists basket_items_basket_idx on public.basket_items(basket_id);
create index if not exists orders_user_status_idx on public.orders(user_id,status);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists payment_events_order_idx on public.payment_events(order_id);
create index if not exists fulfilments_order_idx on public.fulfilments(order_id);

alter table public.baskets enable row level security;
alter table public.basket_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_events enable row level security;
alter table public.fulfilments enable row level security;
alter table public.commission_ledger enable row level security;

create policy "baskets_own" on public.baskets for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "basket_items_own" on public.basket_items for all to authenticated using (exists (select 1 from public.baskets b where b.id = basket_id and b.user_id = auth.uid())) with check (exists (select 1 from public.baskets b where b.id = basket_id and b.user_id = auth.uid()));
create policy "orders_own" on public.orders for select to authenticated using (user_id = auth.uid());
create policy "order_items_own" on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "payment_events_own" on public.payment_events for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "fulfilments_own" on public.fulfilments for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists baskets_updated_at on public.baskets;
create trigger baskets_updated_at before update on public.baskets for each row execute procedure public.set_updated_at();
drop trigger if exists basket_items_updated_at on public.basket_items;
create trigger basket_items_updated_at before update on public.basket_items for each row execute procedure public.set_updated_at();
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders for each row execute procedure public.set_updated_at();
drop trigger if exists fulfilments_updated_at on public.fulfilments;
create trigger fulfilments_updated_at before update on public.fulfilments for each row execute procedure public.set_updated_at();
