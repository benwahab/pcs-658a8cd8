alter table public.report_media
  add column if not exists moderation_status text not null default 'approved',
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid,
  add column if not exists moderation_reason text;

alter table public.report_media drop constraint if exists report_media_moderation_status_check;
alter table public.report_media add constraint report_media_moderation_status_check
  check (moderation_status in ('pending','approved','rejected'));

update public.report_media set moderation_status='approved' where moderation_status is null;

drop policy if exists media_insert on public.report_media;
create policy media_insert on public.report_media
for insert to authenticated
with check (
  uploaded_by=(select auth.uid())
  and (
    (media_role='citizen_evidence' and moderation_status='approved' and exists (
      select 1 from public.reports r where r.id=report_media.report_id and r.citizen_id=(select auth.uid())
    ))
    or
    (media_role='resolution_video' and moderation_status='pending' and media_type like 'video/%'
      and captured_latitude is not null and captured_longitude is not null and exists (
        select 1 from public.report_assignments ra
        join public.reports r on r.id=ra.report_id
        where ra.report_id=report_media.report_id and ra.agent_id=(select auth.uid())
          and ra.unassigned_at is null
          and ra.assignment_status in ('assigned','accepted','in_progress')
          and r.status='in_progress'
      )
    )
  )
);

create or replace view public.public_report_media as
select rm.id,rm.report_id,rm.storage_path,rm.media_type,rm.file_size,rm.created_at,
       rm.captured_latitude,rm.captured_longitude,rm.media_role
from public.report_media rm join public.reports r on r.id=rm.report_id
where r.is_public=true
  and (rm.media_role='citizen_evidence'
       or (rm.media_role='resolution_video' and rm.moderation_status='approved'));