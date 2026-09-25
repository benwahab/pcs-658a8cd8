-- Storage for report evidence. Bucket remains private.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('report-media','report-media',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy report_media_storage_select on storage.objects
for select to authenticated using (
 bucket_id='report-media' and (
   public.has_role('agent') or public.has_role('moderator') or public.has_role('admin')
   or exists(select 1 from public.reports r where r.id::text=(storage.foldername(name))[1] and r.citizen_id=auth.uid())
 )
);

create policy report_media_storage_insert on storage.objects
for insert to authenticated with check (
 bucket_id='report-media' and exists(
   select 1 from public.reports r
   where r.id::text=(storage.foldername(name))[1] and r.citizen_id=auth.uid()
 )
);