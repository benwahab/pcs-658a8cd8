-- PCS: preserve the existing private, shared citizen-report limiter.
-- The live implementation stores rolling event timestamps in private.citizen_report_rate_limits.
-- Do not create a parallel public table or change the RPC's storage model.
create or replace function public.consume_citizen_report_rate_limit(
  p_key_hash text,
  p_max_events integer default 5,
  p_window_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_events timestamptz[];
  v_now timestamptz := clock_timestamp();
  v_cutoff timestamptz;
begin
  if p_key_hash is null
     or length(p_key_hash) <> 64
     or p_max_events < 1 or p_max_events > 100
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    return false;
  end if;

  v_cutoff := v_now - pg_catalog.make_interval(secs => p_window_seconds);

  insert into private.citizen_report_rate_limits(key_hash, event_times, updated_at)
  values (p_key_hash, array[]::timestamptz[], v_now)
  on conflict (key_hash) do nothing;

  select event_times into v_events
  from private.citizen_report_rate_limits
  where key_hash = p_key_hash
  for update;

  select coalesce(array_agg(t), array[]::timestamptz[])
    into v_events
  from unnest(v_events) as t
  where t > v_cutoff;

  if cardinality(v_events) >= p_max_events then
    update private.citizen_report_rate_limits
    set event_times = v_events, updated_at = v_now
    where key_hash = p_key_hash;
    return false;
  end if;

  v_events := array_append(v_events, v_now);
  update private.citizen_report_rate_limits
  set event_times = v_events, updated_at = v_now
  where key_hash = p_key_hash;
  return true;
end;
$function$;

revoke all on function public.consume_citizen_report_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_citizen_report_rate_limit(text, integer, integer) to service_role;
