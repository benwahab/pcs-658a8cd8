-- PCS: server-side rate limiting state for the public agent login flow.
-- No application data is created by this migration.

create table if not exists public.agent_login_rate_limits (
  key_hash text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.agent_login_rate_limits enable row level security;

revoke all on table public.agent_login_rate_limits from public, anon, authenticated;
grant all on table public.agent_login_rate_limits to service_role;

create or replace function public.consume_agent_login_rate_limit(
  p_key_hash text,
  p_max_attempts integer default 5,
  p_window_seconds integer default 600,
  p_block_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = ''
volatile
as $function$
declare
  v_row public.agent_login_rate_limits%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_key_hash is null or pg_catalog.length(p_key_hash) < 32 then
    raise exception 'Clé de limitation invalide';
  end if;

  if p_max_attempts < 1 or p_window_seconds < 1 or p_block_seconds < 1 then
    raise exception 'Paramètres de limitation invalides';
  end if;

  insert into public.agent_login_rate_limits(key_hash)
  values (p_key_hash)
  on conflict (key_hash) do nothing;

  select *
    into v_row
    from public.agent_login_rate_limits
   where key_hash = p_key_hash
   for update;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    return false;
  end if;

  if v_row.window_started_at <= v_now - make_interval(secs => p_window_seconds) then
    update public.agent_login_rate_limits
       set attempts = 1,
           window_started_at = v_now,
           blocked_until = null,
           updated_at = v_now
     where key_hash = p_key_hash;
    return true;
  end if;

  update public.agent_login_rate_limits
     set attempts = attempts + 1,
         blocked_until = case
           when attempts + 1 > p_max_attempts
             then v_now + make_interval(secs => p_block_seconds)
           else blocked_until
         end,
         updated_at = v_now
   where key_hash = p_key_hash
   returning * into v_row;

  return v_row.attempts <= p_max_attempts;
end;
$function$;

revoke all on function public.consume_agent_login_rate_limit(text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_agent_login_rate_limit(text, integer, integer, integer) to service_role;
