-- Public feed projections must be evaluated with the view owner privileges.
-- The views already filter strictly to is_public=true and approved media, so
-- keeping security_invoker=true makes authenticated clients re-enter the
-- underlying reports/report_media RLS graph and can trigger recursive policy
-- evaluation. Do not weaken the base-table RLS policies.

create or replace view public.public_reports
with (security_invoker = false)
as
select
  id,
  reference_code,
  category_id,
  department_id,
  title,
  status,
  priority,
  location_label,
  resolution_note,
  created_at,
  updated_at,
  resolved_at,
  region_id,
  commune_id
from public.reports
where is_public = true;

create or replace view public.public_report_media
with (security_invoker = false)
as
select
  rm.id,
  rm.report_id,
  rm.storage_path,
  rm.media_type,
  rm.file_size,
  rm.created_at,
  null::double precision as captured_latitude,
  null::double precision as captured_longitude,
  rm.media_role,
  rm.moderation_status
from public.report_media rm
join public.reports r on r.id = rm.report_id
where r.is_public = true
  and rm.moderation_status = 'approved'
  and rm.media_role = any (array['citizen_evidence'::text, 'resolution_video'::text]);
