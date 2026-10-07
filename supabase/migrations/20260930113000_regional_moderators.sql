create table if not exists public.moderator_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  region_id uuid not null references public.regions(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists moderator_profiles_region_idx on public.moderator_profiles(region_id);
create index if not exists moderator_profiles_active_region_idx on public.moderator_profiles(region_id,is_active);

alter table public.moderator_profiles enable row level security;

drop policy if exists moderator_profiles_self_select on public.moderator_profiles;
create policy moderator_profiles_self_select
on public.moderator_profiles
for select
to authenticated
using (user_id = auth.uid());

insert into public.roles(code,name)
values ('moderator','Modérateur')
on conflict (code) do nothing;

create or replace function public.set_moderator_profile_updated_at()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists moderator_profiles_updated_at on public.moderator_profiles;
create trigger moderator_profiles_updated_at
before update on public.moderator_profiles
for each row execute function public.set_moderator_profile_updated_at();

revoke all on public.moderator_profiles from anon;
grant select on public.moderator_profiles to authenticated;
