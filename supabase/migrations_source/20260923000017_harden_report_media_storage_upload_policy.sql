drop policy if exists report_media_storage_insert on storage.objects;
drop policy if exists report_media_storage_resolution_insert on storage.objects;

create policy report_media_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='report-media'
  and (
    exists (
      select 1 from public.reports r
      where r.id=(split_part(name,'/',1))::uuid
        and r.citizen_id=(select auth.uid())
    )
    or exists (
      select 1
      from public.report_assignments ra
      join public.reports r on r.id=ra.report_id
      where ra.report_id=(split_part(name,'/',1))::uuid
        and ra.agent_id=(select auth.uid())
        and ra.unassigned_at is null
        and ra.assignment_status in ('assigned','accepted','in_progress')
        and r.status='in_progress'
        and lower(storage.extension(name)) in ('mp4','webm','mov','m4v')
    )
  )
);

create policy report_media_storage_owner_update on storage.objects
for update to authenticated
using (
  bucket_id='report-media'
  and owner_id=(select auth.uid()::text)
  and false
)
with check (false);

create policy report_media_storage_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id='report-media'
  and owner_id=(select auth.uid()::text)
  and false
);
