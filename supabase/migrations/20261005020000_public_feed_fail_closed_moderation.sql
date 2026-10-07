-- Expose moderation status to the public-feed client so it can fail closed.
-- The view itself still returns only approved media attached to public reports.
create or replace view public.public_report_media as
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
  'Public feed media only: public reports and explicitly approved media. Client must still fail closed on moderation_status.';
