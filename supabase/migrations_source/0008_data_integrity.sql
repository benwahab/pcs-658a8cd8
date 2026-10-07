-- Production input constraints mirrored by the frontend.
alter table public.reports drop constraint if exists reports_title_length;
alter table public.reports add constraint reports_title_length check (char_length(trim(title)) between 5 and 120);
alter table public.reports drop constraint if exists reports_description_length;
alter table public.reports add constraint reports_description_length check (char_length(trim(description)) between 10 and 5000);
alter table public.report_comments drop constraint if exists report_comments_body_length;
alter table public.report_comments add constraint report_comments_body_length check (char_length(trim(body)) between 1 and 5000);
alter table public.report_media drop constraint if exists report_media_size_limit;
alter table public.report_media add constraint report_media_size_limit check (file_size is null or file_size between 1 and 8388608);
