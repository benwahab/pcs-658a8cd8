create table if not exists public.cst_accounts (
  id smallint primary key default 1 check (id = 1),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);
alter table public.cst_accounts enable row level security;
revoke all on public.cst_accounts from anon, authenticated;
grant select on public.cst_accounts to authenticated;
drop policy if exists "cst_accounts_select_own" on public.cst_accounts;
create policy "cst_accounts_select_own" on public.cst_accounts for select to authenticated using (user_id = auth.uid());
create table if not exists public.cst_auth_rate_limits (
  key_hash text primary key, window_started_at timestamptz not null default now(),
  attempts integer not null default 0, blocked_until timestamptz
);
alter table public.cst_auth_rate_limits enable row level security;
revoke all on public.cst_auth_rate_limits from anon, authenticated;
create or replace function public.consume_cst_auth_rate_limit(p_key_hash text,p_max_attempts integer default 5,p_window_seconds integer default 600,p_block_seconds integer default 900)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz := clock_timestamp(); v_row public.cst_auth_rate_limits%rowtype;
begin
 if p_key_hash is null or length(p_key_hash)<16 then return false; end if;
 insert into public.cst_auth_rate_limits(key_hash,window_started_at,attempts) values(p_key_hash,v_now,1) on conflict(key_hash) do nothing;
 select * into v_row from public.cst_auth_rate_limits where key_hash=p_key_hash for update;
 if v_row.blocked_until is not null and v_row.blocked_until>v_now then return false; end if;
 if v_row.window_started_at + make_interval(secs=>p_window_seconds)<=v_now then
  update public.cst_auth_rate_limits set window_started_at=v_now,attempts=1,blocked_until=null where key_hash=p_key_hash; return true;
 end if;
 if v_row.attempts>=p_max_attempts then
  update public.cst_auth_rate_limits set blocked_until=v_now+make_interval(secs=>p_block_seconds) where key_hash=p_key_hash; return false;
 end if;
 update public.cst_auth_rate_limits set attempts=attempts+1 where key_hash=p_key_hash; return true;
end; $$;
revoke all on function public.consume_cst_auth_rate_limit(text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_cst_auth_rate_limit(text,integer,integer,integer) to service_role;