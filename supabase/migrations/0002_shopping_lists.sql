create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Shopping List',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  special_id uuid references public.specials(id) on delete set null,
  quantity numeric(12,3) not null default 1,
  note text,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopping_list_item_quantity_positive check (quantity > 0),
  constraint shopping_list_item_target check (product_id is not null or special_id is not null)
);

create index shopping_lists_user_idx on public.shopping_lists(user_id);
create index shopping_list_items_list_idx on public.shopping_list_items(shopping_list_id);
create index shopping_list_items_product_idx on public.shopping_list_items(product_id);
create index shopping_list_items_special_idx on public.shopping_list_items(special_id);

alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;

create policy "shopping_lists_select_own"
  on public.shopping_lists for select
  to authenticated
  using (auth.uid() = user_id);

create policy "shopping_lists_insert_own"
  on public.shopping_lists for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "shopping_lists_update_own"
  on public.shopping_lists for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "shopping_lists_delete_own"
  on public.shopping_lists for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "shopping_list_items_select_own"
  on public.shopping_list_items for select
  to authenticated
  using (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = shopping_list_id and sl.user_id = auth.uid()
    )
  );

create policy "shopping_list_items_insert_own"
  on public.shopping_list_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = shopping_list_id and sl.user_id = auth.uid()
    )
  );

create policy "shopping_list_items_update_own"
  on public.shopping_list_items for update
  to authenticated
  using (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = shopping_list_id and sl.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = shopping_list_id and sl.user_id = auth.uid()
    )
  );

create policy "shopping_list_items_delete_own"
  on public.shopping_list_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = shopping_list_id and sl.user_id = auth.uid()
    )
  );
