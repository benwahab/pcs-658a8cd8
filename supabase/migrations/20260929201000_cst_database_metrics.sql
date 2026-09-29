create or replace function public.cst_database_metrics()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_connections integer; v_max integer; v_size bigint;
begin
  select count(*) into v_connections from pg_stat_activity where datname=current_database();
  v_max:=current_setting('max_connections')::integer;
  v_size:=pg_database_size(current_database());
  return jsonb_build_object('connections',v_connections,'max_connections',v_max,'connection_utilization_percent',case when v_max>0 then round((v_connections::numeric/v_max::numeric)*100,2) else null end,'database_size_bytes',v_size);
end; $$;
revoke all on function public.cst_database_metrics() from public,anon,authenticated;
grant execute on function public.cst_database_metrics() to service_role;