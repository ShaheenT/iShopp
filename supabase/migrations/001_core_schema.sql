-- iShopp Core OS — database foundation
-- PostgreSQL / Supabase

create extension if not exists pgcrypto;

create type public.retailer_status as enum ('active', 'inactive');
create type public.product_status as enum ('active', 'inactive');
create type public.special_type as enum ('price', 'discount', 'multibuy', 'bundle');
create type public.special_status as enum ('draft', 'active', 'expired', 'cancelled');
create type public.list_status as enum ('active', 'completed', 'archived');
create type public.order_status as enum ('pending', 'confirmed', 'processing', 'fulfilled', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.retailers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status public.retailer_status not null default 'active',
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  name text not null,
  address_line_1 text,
  address_line_2 text,
  suburb text,
  city text,
  province text,
  postal_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (retailer_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  barcode text unique,
  unit text,
  status public.product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.specials (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  product_id uuid not null references public.products(id) on delete cascade,
  type public.special_type not null,
  title text not null,
  description text,
  regular_price numeric(12,2),
  special_price numeric(12,2),
  discount_percent numeric(5,2),
  quantity_required integer,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  status public.special_status not null default 'draft',
  source_url text,
  source_type text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint specials_valid_window check (valid_until > valid_from),
  constraint specials_prices_nonnegative check ((regular_price is null or regular_price >= 0) and (special_price is null or special_price >= 0)),
  constraint specials_quantity_positive check (quantity_required is null or quantity_required > 0)
);

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'My Shopping List',
  status public.list_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(10,2) not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, product_id),
  constraint shopping_list_items_quantity_positive check (quantity > 0)
);

create table public.baskets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.basket_items (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references public.baskets(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  special_id uuid references public.specials(id) on delete set null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint basket_items_quantity_positive check (quantity > 0),
  constraint basket_items_price_nonnegative check (unit_price >= 0)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  basket_id uuid references public.baskets(id) on delete set null,
  status public.order_status not null default 'pending',
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  currency char(3) not null default 'ZAR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_amounts_nonnegative check (subtotal >= 0 and delivery_fee >= 0 and total >= 0)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  special_id uuid references public.specials(id) on delete set null,
  product_name text not null,
  quantity numeric(10,2) not null,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now(),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_amounts_nonnegative check (unit_price >= 0 and line_total >= 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_reference text,
  status public.payment_status not null default 'pending',
  amount numeric(12,2) not null,
  currency char(3) not null default 'ZAR',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_positive check (amount > 0),
  unique (provider, provider_reference)
);

create index branches_retailer_id_idx on public.branches(retailer_id);
create index specials_product_id_idx on public.specials(product_id);
create index specials_retailer_id_idx on public.specials(retailer_id);
create index specials_branch_id_idx on public.specials(branch_id);
create index specials_validity_idx on public.specials(status, valid_from, valid_until);
create index shopping_lists_user_id_idx on public.shopping_lists(user_id);
create index shopping_list_items_list_id_idx on public.shopping_list_items(list_id);
create index baskets_user_id_idx on public.baskets(user_id);
create index basket_items_basket_id_idx on public.basket_items(basket_id);
create index orders_user_id_idx on public.orders(user_id);
create index orders_status_idx on public.orders(status);
create index order_items_order_id_idx on public.order_items(order_id);
create index payments_order_id_idx on public.payments(order_id);
create index payments_status_idx on public.payments(status);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger retailers_set_updated_at before update on public.retailers for each row execute procedure public.set_updated_at();
create trigger branches_set_updated_at before update on public.branches for each row execute procedure public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute procedure public.set_updated_at();
create trigger specials_set_updated_at before update on public.specials for each row execute procedure public.set_updated_at();
create trigger shopping_lists_set_updated_at before update on public.shopping_lists for each row execute procedure public.set_updated_at();
create trigger shopping_list_items_set_updated_at before update on public.shopping_list_items for each row execute procedure public.set_updated_at();
create trigger baskets_set_updated_at before update on public.baskets for each row execute procedure public.set_updated_at();
create trigger basket_items_set_updated_at before update on public.basket_items for each row execute procedure public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders for each row execute procedure public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.retailers enable row level security;
alter table public.branches enable row level security;
alter table public.products enable row level security;
alter table public.specials enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.baskets enable row level security;
alter table public.basket_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy retailers_public_read on public.retailers for select using (status = 'active');
create policy branches_public_read on public.branches for select using (is_active = true);
create policy products_public_read on public.products for select using (status = 'active');
create policy specials_public_read on public.specials for select using (status = 'active' and valid_from <= now() and valid_until > now());
create policy shopping_lists_own_all on public.shopping_lists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy shopping_list_items_own_all on public.shopping_list_items for all using (exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid())) with check (exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid()));
create policy baskets_own_all on public.baskets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy basket_items_own_all on public.basket_items for all using (exists (select 1 from public.baskets b where b.id = basket_id and b.user_id = auth.uid())) with check (exists (select 1 from public.baskets b where b.id = basket_id and b.user_id = auth.uid()));
create policy orders_own_read on public.orders for select using (auth.uid() = user_id);
create policy order_items_own_read on public.order_items for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy payments_own_read on public.payments for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
