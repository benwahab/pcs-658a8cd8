-- Scope CST video moderation to citizen evidence videos only.
-- Resolution videos remain outside CST moderation and are approved by their existing workflow.

create or replace function public.prepare_report_media_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.media_role = 'citizen_evidence' and new.media_type like 'video/%' then
    new.moderation_status := 'pending';
    new.moderated_at := null;
    new.moderated_by := null;
    new.moderation_reason := null;
  elsif new.media_role = 'resolution_video' then
    new.moderation_status := 'approved';
    new.moderated_at := null;
    new.moderated_by := null;
    new.moderation_reason := null;
  else
    new.moderation_status := 'approved';
  end if;
  return new;
end;
$function$;

drop policy if exists media_insert on public.report_media;
create policy media_insert on public.report_media
for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and (
    (
      media_role = 'citizen_evidence'
      and moderation_status = 'approved'
      and media_type not like 'video/%'
      and exists (
        select 1 from public.reports r
        where r.id = report_media.report_id
          and r.citizen_id = (select auth.uid())
      )
    )
    or
    (
      media_role = 'citizen_evidence'
      and moderation_status = 'pending'
      and media_type like 'video/%'
      and exists (
        select 1 from public.reports r
        where r.id = report_media.report_id
          and r.citizen_id = (select auth.uid())
      )
    )
    or
    (
      media_role = 'resolution_video'
      and moderation_status = 'approved'
      and media_type like 'video/%'
      and captured_latitude is not null
      and captured_longitude is not null
      and exists (
        select 1
        from public.report_assignments ra
        join public.reports r on r.id = ra.report_id
        where ra.report_id = report_media.report_id
          and ra.agent_id = (select auth.uid())
          and ra.unassigned_at is null
          and ra.assignment_status in ('assigned','accepted','in_progress')
          and r.status = 'in_progress'
      )
    )
  )
);

create or replace view public.public_report_media as
select
  rm.id,
  rm.report_id,
  rm.storage_path,
  rm.media_type,
  rm.file_size,
  rm.created_at,
  rm.captured_latitude,
  rm.captured_longitude,
  rm.media_role
from public.report_media rm
join public.reports r on r.id = rm.report_id
where r.is_public = true
  and rm.moderation_status = 'approved'
  and rm.media_role in ('citizen_evidence','resolution_video');

drop policy if exists report_media_storage_public_read on storage.objects;
create policy report_media_storage_public_read
on storage.objects
for select to public
using (
  bucket_id = 'report-media'
  and exists (
    select 1
    from public.report_media rm
    join public.reports r on r.id = rm.report_id
    where rm.storage_path = objects.name
      and r.is_public = true
      and rm.moderation_status = 'approved'
      and rm.media_role in ('citizen_evidence','resolution_video')
  )
);
