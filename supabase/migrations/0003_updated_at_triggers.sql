create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger retailers_set_updated_at
before update on public.retailers
for each row execute procedure public.set_updated_at();

create trigger store_branches_set_updated_at
before update on public.store_branches
for each row execute procedure public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute procedure public.set_updated_at();

create trigger specials_set_updated_at
before update on public.specials
for each row execute procedure public.set_updated_at();

create trigger shopping_lists_set_updated_at
before update on public.shopping_lists
for each row execute procedure public.set_updated_at();

create trigger shopping_list_items_set_updated_at
before update on public.shopping_list_items
for each row execute procedure public.set_updated_at();
