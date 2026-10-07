-- Resolution proof videos are private audit evidence, not operational/public media.
-- CST archive access uses the service-role archive endpoint with 15-minute signed URLs.
drop policy if exists report_media_storage_staff_read on storage.objects;
create policy report_media_storage_staff_read
on storage.objects for select to authenticated
using (
  bucket_id = 'report-media'
  and private.is_staff()
  and exists (
    select 1 from public.report_media rm
    where rm.storage_path = objects.name
      and rm.media_role <> 'resolution_video'
  )
);

drop policy if exists report_media_storage_public_read on storage.objects;
create policy report_media_storage_public_read
on storage.objects for select to public
using (
  bucket_id = 'report-media'
  and exists (
    select 1
    from public.report_media rm
    join public.reports r on r.id = rm.report_id
    where rm.storage_path = objects.name
      and r.is_public = true
      and rm.moderation_status = 'approved'
      and rm.media_role = 'citizen_evidence'
  )
);
