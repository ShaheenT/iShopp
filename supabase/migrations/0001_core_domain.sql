create extension if not exists pgcrypto;

create type public.retailer_status as enum ('pending', 'active', 'suspended');
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.retailers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status public.retailer_status not null default 'pending',
  verification_status public.verification_status not null default 'unverified',
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_branches (
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
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid references public.retailers(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  brand text,
  sku text,
  barcode text,
  unit text,
  image_url text,
  verification_status public.verification_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index products_retailer_sku_unique
  on public.products(retailer_id, sku)
  where sku is not null;

create table public.specials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  store_branch_id uuid references public.store_branches(id) on delete set null,
  title text,
  regular_price numeric(12,2),
  special_price numeric(12,2) not null,
  currency char(3) not null default 'ZAR',
  starts_at timestamptz not null,
  ends_at timestamptz,
  source_url text,
  source_type text,
  verification_status public.verification_status not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint specials_price_positive check (special_price >= 0),
  constraint specials_regular_price_valid check (regular_price is null or regular_price >= 0),
  constraint specials_dates_valid check (ends_at is null or ends_at > starts_at)
);

create index store_branches_retailer_idx on public.store_branches(retailer_id);
create index products_category_idx on public.products(category_id);
create index specials_product_idx on public.specials(product_id);
create index specials_retailer_idx on public.specials(retailer_id);
create index specials_active_window_idx on public.specials(starts_at, ends_at);

alter table public.profiles enable row level security;
alter table public.retailers enable row level security;
alter table public.store_branches enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.specials enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "retailers_public_read_active"
  on public.retailers for select
  to anon, authenticated
  using (status = 'active' and verification_status = 'verified');

create policy "branches_public_read_active"
  on public.store_branches for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.retailers r
      where r.id = retailer_id
        and r.status = 'active'
        and r.verification_status = 'verified'
    )
  );

create policy "categories_public_read"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "products_public_read_verified"
  on public.products for select
  to anon, authenticated
  using (verification_status = 'verified');

create policy "specials_public_read_verified"
  on public.specials for select
  to anon, authenticated
  using (
    verification_status = 'verified'
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
