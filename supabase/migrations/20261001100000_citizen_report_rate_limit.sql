-- Shared, atomic rate limiting for anonymous citizen report submissions.
-- Store only a keyed hash of the source IP; never persist raw IP addresses.
create table if not exists public.citizen_report_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  events integer not null default 0 check (events >= 0)
);

alter table public.citizen_report_rate_limits enable row level security;
revoke all on public.citizen_report_rate_limits from public, anon, authenticated;

create or replace function public.consume_citizen_report_rate_limit(
  p_key_hash text,
  p_max_events integer default 5,
  p_window_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.citizen_report_rate_limits%rowtype;
begin
  if p_key_hash is null or length(p_key_hash) <> 64
     or p_max_events < 1 or p_max_events > 100
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    return false;
  end if;

  insert into public.citizen_report_rate_limits(key_hash, window_started_at, events)
  values (p_key_hash, v_now, 0)
  on conflict (key_hash) do nothing;

  select * into v_row
  from public.citizen_report_rate_limits
  where key_hash = p_key_hash
  for update;

  if v_row.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    update public.citizen_report_rate_limits
    set window_started_at = v_now, events = 1
    where key_hash = p_key_hash;
    return true;
  end if;

  if v_row.events >= p_max_events then
    return false;
  end if;

  update public.citizen_report_rate_limits
  set events = events + 1
  where key_hash = p_key_hash;
  return true;
end;
$$;

revoke all on function public.consume_citizen_report_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_citizen_report_rate_limit(text, integer, integer) to service_role;
