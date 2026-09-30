-- Route citizen evidence videos through the authenticated server validator.
-- Resolution videos and citizen photos keep their existing upload paths.
drop policy if exists media_insert on public.report_media;
create policy media_insert
on public.report_media
for insert
to authenticated
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
    or (
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

drop policy if exists report_media_storage_insert on storage.objects;
create policy report_media_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-media'
  and (
    (
      lower(storage.extension(objects.name)) in ('jpg','jpeg','png','webp')
      and exists (
        select 1 from public.reports r
        where r.id = (split_part(objects.name,'/',1))::uuid
          and r.citizen_id = (select auth.uid())
      )
    )
    or (
      lower(storage.extension(objects.name)) in ('mp4','webm','mov','m4v')
      and exists (
        select 1
        from public.report_assignments ra
        join public.reports r on r.id = ra.report_id
        where ra.report_id = (split_part(objects.name,'/',1))::uuid
          and ra.agent_id = (select auth.uid())
          and ra.unassigned_at is null
          and ra.assignment_status in ('assigned','accepted','in_progress')
          and r.status = 'in_progress'
      )
    )
  )
);