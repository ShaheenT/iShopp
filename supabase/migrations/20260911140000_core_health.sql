create table if not exists public.system_health (
  id text primary key,
  service text not null,
  status text not null default 'ok' check (status in ('ok', 'degraded', 'down')),
  updated_at timestamptz not null default now()
);

alter table public.system_health enable row level security;

insert into public.system_health (id, service, status)
values ('ishopp-api', 'ishopp-api', 'ok')
on conflict (id) do update
set service = excluded.service,
    status = excluded.status,
    updated_at = now();
