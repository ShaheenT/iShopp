create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.retailers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  website_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  name text not null,
  address_line_1 text not null,
  address_line_2 text,
  suburb text,
  city text not null,
  province text,
  postal_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (retailer_id, name)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  brand text,
  description text,
  barcode text,
  image_url text,
  unit_text text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_barcode_unique
  on public.products (barcode)
  where barcode is not null;

create table if not exists public.specials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  title text not null,
  price numeric(12,2),
  original_price numeric(12,2),
  currency text not null default 'ZAR',
  starts_at timestamptz,
  ends_at timestamptz,
  source_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price is null or price >= 0),
  check (original_price is null or original_price >= 0),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Shopping List',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity numeric(12,3) not null default 1,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity > 0)
);

create table if not exists public.saved_products (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  special_id uuid references public.specials(id) on delete set null,
  list_id uuid references public.shopping_lists(id) on delete set null,
  channel text not null,
  created_at timestamptz not null default now(),
  check (product_id is not null or special_id is not null or list_id is not null)
);

create index if not exists branches_retailer_id_idx on public.branches(retailer_id);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists specials_product_id_idx on public.specials(product_id);
create index if not exists specials_retailer_id_idx on public.specials(retailer_id);
create index if not exists specials_branch_id_idx on public.specials(branch_id);
create index if not exists shopping_lists_user_id_idx on public.shopping_lists(user_id);
create index if not exists shopping_list_items_list_id_idx on public.shopping_list_items(list_id);
create index if not exists shares_user_id_idx on public.shares(user_id);

alter table public.profiles enable row level security;
alter table public.retailers enable row level security;
alter table public.branches enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.specials enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.saved_products enable row level security;
alter table public.shares enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "retailers_public_read" on public.retailers
  for select to anon, authenticated using (active = true);
create policy "branches_public_read" on public.branches
  for select to anon, authenticated using (active = true);
create policy "categories_public_read" on public.categories
  for select to anon, authenticated using (active = true);
create policy "products_public_read" on public.products
  for select to anon, authenticated using (active = true);
create policy "specials_public_read" on public.specials
  for select to anon, authenticated using (active = true);

create policy "shopping_lists_select_own" on public.shopping_lists
  for select to authenticated using (user_id = auth.uid());
create policy "shopping_lists_insert_own" on public.shopping_lists
  for insert to authenticated with check (user_id = auth.uid());
create policy "shopping_lists_update_own" on public.shopping_lists
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "shopping_lists_delete_own" on public.shopping_lists
  for delete to authenticated using (user_id = auth.uid());

create policy "shopping_list_items_select_own" on public.shopping_list_items
  for select to authenticated using (
    exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid())
  );
create policy "shopping_list_items_insert_own" on public.shopping_list_items
  for insert to authenticated with check (
    exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid())
  );
create policy "shopping_list_items_update_own" on public.shopping_list_items
  for update to authenticated using (
    exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid())
  );
create policy "shopping_list_items_delete_own" on public.shopping_list_items
  for delete to authenticated using (
    exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid())
  );

create policy "saved_products_select_own" on public.saved_products
  for select to authenticated using (user_id = auth.uid());
create policy "saved_products_insert_own" on public.saved_products
  for insert to authenticated with check (user_id = auth.uid());
create policy "saved_products_delete_own" on public.saved_products
  for delete to authenticated using (user_id = auth.uid());

create policy "shares_select_own" on public.shares
  for select to authenticated using (user_id = auth.uid());
create policy "shares_insert_own" on public.shares
  for insert to authenticated with check (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
