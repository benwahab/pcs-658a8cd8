alter table public.reports add column if not exists archived_at timestamptz;

create or replace view public.public_reports as
 SELECT r.id, r.reference_code, r.category_id, r.department_id, r.title, r.status, r.priority,
        r.location_label, r.resolution_note, r.created_at, r.updated_at, r.resolved_at,
        r.region_id, r.commune_id
 FROM public.reports r
 WHERE r.is_public = true AND r.archived_at IS NULL
 AND EXISTS (
   SELECT 1 FROM public.report_media rm
   WHERE rm.report_id = r.id
     AND rm.media_role = 'citizen_evidence'
     AND rm.moderation_status = 'approved'
     AND (rm.media_type LIKE 'image/%' OR rm.media_type LIKE 'video/%')
 );

create or replace view public.public_report_media as
 SELECT rm.id, rm.report_id, rm.storage_path, rm.media_type, rm.file_size, rm.created_at,
        NULL::double precision AS captured_latitude,
        NULL::double precision AS captured_longitude,
        rm.media_role, rm.moderation_status
 FROM public.report_media rm
 JOIN public.reports r ON r.id = rm.report_id
 WHERE r.is_public = true AND r.archived_at IS NULL
   AND rm.moderation_status = 'approved'
   AND rm.media_role = ANY (ARRAY['citizen_evidence','resolution_video']);
