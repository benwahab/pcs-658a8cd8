alter table public.reports add column if not exists is_public boolean not null default true;
create index if not exists reports_public_feed_idx on public.reports (is_public, created_at desc);
create or replace function private.enforce_report_public_visibility()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'rejected' then new.is_public := false; end if;
  return new;
end;
$$;
drop trigger if exists enforce_report_public_visibility_trigger on public.reports;
create trigger enforce_report_public_visibility_trigger before insert or update of status, is_public on public.reports for each row execute function private.enforce_report_public_visibility();
update public.reports set is_public = false where status = 'rejected';
create or replace view public.public_reports as
select r.id,r.reference_code,r.category_id,r.department_id,r.title,r.status,r.priority,r.latitude,r.longitude,r.location_label,r.resolution_note,r.created_at,r.updated_at,r.resolved_at,r.region_id,r.commune_id
from public.reports r where r.is_public = true;
create or replace view public.public_report_media as
select rm.id,rm.report_id,rm.storage_path,rm.media_type,rm.file_size,rm.created_at,rm.captured_latitude,rm.captured_longitude,rm.media_role
from public.report_media rm join public.reports r on r.id=rm.report_id where r.is_public=true;
grant select on public.public_reports to anon, authenticated;
grant select on public.public_report_media to anon, authenticated;
drop policy if exists reports_read on public.reports;
drop policy if exists reports_select_scoped on public.reports;
drop policy if exists media_read on public.report_media;
drop policy if exists media_select_scoped on public.report_media;
drop policy if exists report_media_storage_read on storage.objects;
create policy report_media_storage_public_read on storage.objects for select to public using (bucket_id='report-media' and exists (select 1 from public.report_media rm join public.reports r on r.id=rm.report_id where rm.storage_path=objects.name and r.is_public=true));
create policy reports_select_scoped on public.reports for select to public using (
 citizen_id=auth.uid() or private.is_staff() or exists(select 1 from public.mairies m where m.account_user_id=auth.uid() and m.commune_id=reports.commune_id and m.is_active)
 or exists(select 1 from public.report_assignments ra where ra.report_id=reports.id and ra.agent_id=auth.uid() and ra.unassigned_at is null)
);
create policy media_select_scoped on public.report_media for select to public using (exists(select 1 from public.reports r where r.id=report_media.report_id and (
 r.citizen_id=auth.uid() or private.is_staff() or exists(select 1 from public.mairies m where m.account_user_id=auth.uid() and m.commune_id=r.commune_id and m.is_active)
 or exists(select 1 from public.report_assignments ra where ra.report_id=r.id and ra.agent_id=auth.uid() and ra.unassigned_at is null)
)));
