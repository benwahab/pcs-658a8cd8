-- Keep the citizen-facing media projection limited to approved citizen evidence.
-- Resolution videos are private CST audit evidence and must not appear in the public feed.
-- This migration changes only the public projection; it does not alter report/media records.
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
  rm.media_role
from public.report_media rm
join public.reports r on r.id = rm.report_id
where r.is_public = true
  and rm.moderation_status = 'approved'
  and rm.media_role = 'citizen_evidence';

comment on view public.public_report_media is
  'Citizen-facing projection of approved citizen evidence only; resolution videos and capture coordinates are excluded.';
