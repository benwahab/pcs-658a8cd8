-- Fix Storage signed-URL authorization recursion for public media.
-- Storage object policies must not recursively evaluate the reports/report_media
-- RLS graph while Storage is resolving an object for a signed URL.

create or replace function private.can_read_public_report_media_storage(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.report_media rm
    join public.reports r on r.id = rm.report_id
    where rm.storage_path = p_storage_path
      and r.is_public = true
      and rm.moderation_status = 'approved'
      and rm.media_role = any (array['citizen_evidence'::text, 'resolution_video'::text])
  );
$$;

create or replace function private.can_read_mairie_resolution_media_storage(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.report_media rm
    join public.reports r on r.id = rm.report_id
    join public.mairies m on m.commune_id = r.commune_id
    where rm.storage_path = p_storage_path
      and rm.media_role = 'resolution_video'
      and m.account_user_id = (select auth.uid())
      and m.is_active = true
  );
$$;

revoke all on function private.can_read_public_report_media_storage(text) from public;
revoke all on function private.can_read_mairie_resolution_media_storage(text) from public;
grant execute on function private.can_read_public_report_media_storage(text) to anon, authenticated;
grant execute on function private.can_read_mairie_resolution_media_storage(text) to authenticated;

drop policy if exists report_media_storage_public_read on storage.objects;
create policy report_media_storage_public_read
on storage.objects
for select
to public
using (
  bucket_id = 'report-media'
  and (select private.can_read_public_report_media_storage(name))
);

drop policy if exists report_media_storage_mairie_resolution_read on storage.objects;
create policy report_media_storage_mairie_resolution_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'report-media'
  and (select private.can_read_mairie_resolution_media_storage(name))
);
