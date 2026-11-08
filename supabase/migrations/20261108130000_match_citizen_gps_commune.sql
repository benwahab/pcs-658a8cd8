create or replace function public.match_citizen_gps_commune(
  p_latitude double precision,
  p_longitude double precision
)
returns table (
  commune_id uuid,
  commune_name text,
  region_id uuid,
  region_name text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select c.id, c.name, c.region_id, r.name
  from public.communes as c
  join public.regions as r on r.id = c.region_id
  where c.is_active is true
    and c.boundary is not null
    and p_latitude between -90 and 90
    and p_longitude between -180 and 180
    and extensions.st_covers(
      c.boundary,
      extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)
    )
  order by c.name
  limit 3;
$function$;

revoke all on function public.match_citizen_gps_commune(double precision, double precision) from public;
grant execute on function public.match_citizen_gps_commune(double precision, double precision) to anon, authenticated, service_role;

comment on function public.match_citizen_gps_commune(double precision, double precision)
  is 'Returns the Niger commune boundaries covering a citizen GPS point; used to verify report territory.';
