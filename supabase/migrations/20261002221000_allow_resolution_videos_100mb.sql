-- Keep database metadata validation aligned with the private Storage bucket limit.
alter table public.report_media
  drop constraint if exists report_media_file_size_check;
alter table public.report_media
  add constraint report_media_file_size_check
  check (file_size is null or (file_size >= 1 and file_size <= 104857600));
