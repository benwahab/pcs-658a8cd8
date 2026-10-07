-- Expose moderation status to the public-feed client so its fail-closed check can run.
-- The view itself continues to return approved media only; this adds no pending rows.
create or replace view public.public_report_media
with (security_invoker = true)
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

comment on view public.public_report_media is
  'Public projection of approved citizen evidence and mairie-approved resolution videos only; moderation status is exposed for client fail-closed checks and capture coordinates are excluded.';
