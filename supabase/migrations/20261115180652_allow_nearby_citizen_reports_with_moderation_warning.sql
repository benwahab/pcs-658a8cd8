drop trigger if exists trg_prevent_duplicate_report_by_gps on public.reports;
drop function if exists private.prevent_duplicate_report_by_gps();

create or replace function public.find_nearby_reports_for_moderation(p_report_id uuid)
returns table (
  id uuid,
  reference_code text,
  title text,
  status text,
  created_at timestamptz,
  distance_m double precision
)
language sql
security invoker
set search_path = ''
as $$
  select
    r.id,
    r.reference_code,
    r.title,
    r.status,
    r.created_at,
    public.earth_distance(
      public.ll_to_earth(r.latitude, r.longitude),
      public.ll_to_earth(target.latitude, target.longitude)
    )::double precision as distance_m
  from public.reports target
  join public.reports r
    on r.id <> target.id
   and r.latitude is not null
   and r.longitude is not null
   and r.status not in ('resolved', 'rejected')
  where target.id = p_report_id
    and target.latitude is not null
    and target.longitude is not null
    and public.earth_distance(
      public.ll_to_earth(r.latitude, r.longitude),
      public.ll_to_earth(target.latitude, target.longitude)
    ) <= 20
  order by distance_m asc, r.created_at desc
  limit 10;
$$;

revoke all on function public.find_nearby_reports_for_moderation(uuid) from public, anon, authenticated;
grant execute on function public.find_nearby_reports_for_moderation(uuid) to service_role;
