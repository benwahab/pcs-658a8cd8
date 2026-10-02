-- PCS video policy: accept files up to 100 MiB without an artificial duration cap.
-- Keep the existing bucket private; access remains governed by signed URLs and RLS.
update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']::text[]
where id = 'report-media';

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'report-media') then
    raise exception 'Bucket report-media not found; video limit migration aborted';
  end if;
end $$;
