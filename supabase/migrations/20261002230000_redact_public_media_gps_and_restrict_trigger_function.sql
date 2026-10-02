-- Tighten public report projections without changing report or media records.
-- Public pages may show approved evidence, but must not disclose capture coordinates.
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
  and rm.media_role = any (array['citizen_evidence'::text, 'resolution_video'::text]);

-- Ensure the public report projection obeys the caller's underlying table RLS.
alter view public.public_reports set (security_invoker = true);

-- Trigger functions are invoked by their trigger, not directly by client RPC.
revoke all on function public.register_resolution_video_archive() from public;
revoke all on function public.register_resolution_video_archive() from anon;
revoke all on function public.register_resolution_video_archive() from authenticated;

comment on view public.public_report_media is
  'Public approved media projection; capture coordinates are intentionally redacted.';
