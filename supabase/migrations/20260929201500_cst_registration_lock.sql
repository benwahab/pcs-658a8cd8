create table if not exists public.cst_registration_lock (
  id smallint primary key default 1 check (id=1),
  registered_at timestamptz not null default now()
);
alter table public.cst_registration_lock enable row level security;
revoke all on public.cst_registration_lock from anon, authenticated;