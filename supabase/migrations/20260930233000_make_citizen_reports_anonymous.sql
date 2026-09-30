-- Make citizen reporting permanently anonymous.
-- Reports must never be linked to a citizen auth/profile account.
-- Existing production report count is currently zero; drop the legacy account link entirely.

drop trigger if exists report_status_history_trigger on public.reports;
drop trigger if exists notify_report_status_change_trigger on public.reports;

drop function if exists public.record_report_status_change();
drop function if exists public.notify_report_status_change();

drop policy if exists reports_insert_citizen on public.reports;
drop policy if exists reports_select_scoped on public.reports;
drop policy if exists reports_mairie_update_commune on public.reports;

create policy reports_select_scoped
on public.reports
for select
to public
using (
  private.is_staff()
  or exists (
    select 1 from public.mairies m
    where m.account_user_id = (select auth.uid())
      and m.commune_id = reports.commune_id
      and m.is_active
  )
  or exists (
    select 1
    from public.report_assignments ra
    where ra.report_id = reports.id
      and ra.agent_id = (select auth.uid())
      and ra.unassigned_at is null
  )
);

create policy reports_mairie_update_commune
on public.reports
for update
to authenticated
using (
  private.is_staff()
  or exists (
    select 1 from public.mairies m
    where m.id = private.my_mairie_id()
      and m.account_user_id = (select auth.uid())
      and m.is_active
      and m.commune_id = reports.commune_id
  )
)
with check (
  private.is_staff()
  or (
    exists (
      select 1 from public.mairies m
      where m.id = private.my_mairie_id()
        and m.account_user_id = (select auth.uid())
        and m.is_active
        and m.commune_id = reports.commune_id
    )
    and not (status is distinct from (select r0.status from public.reports r0 where r0.id=reports.id))
    and not (reference_code is distinct from (select r0.reference_code from public.reports r0 where r0.id=reports.id))
    and not (category_id is distinct from (select r0.category_id from public.reports r0 where r0.id=reports.id))
    and not (latitude is distinct from (select r0.latitude from public.reports r0 where r0.id=reports.id))
    and not (longitude is distinct from (select r0.longitude from public.reports r0 where r0.id=reports.id))
    and not (commune_id is distinct from (select r0.commune_id from public.reports r0 where r0.id=reports.id))
    and not (region_id is distinct from (select r0.region_id from public.reports r0 where r0.id=reports.id))
    and not (resolved_at is distinct from (select r0.resolved_at from public.reports r0 where r0.id=reports.id))
    and not (created_at is distinct from (select r0.created_at from public.reports r0 where r0.id=reports.id))
    and not (is_public is distinct from (select r0.is_public from public.reports r0 where r0.id=reports.id))
  )
);

drop policy if exists media_select_scoped on public.report_media;
create policy media_select_scoped
on public.report_media
for select
to authenticated
using (
  exists (
    select 1
    from public.reports r
    where r.id = report_media.report_id
      and (
        private.is_staff()
        or exists (
          select 1 from public.mairies m
          where m.account_user_id = (select auth.uid())
            and m.commune_id = r.commune_id
            and m.is_active
        )
        or exists (
          select 1 from public.report_assignments ra
          where ra.report_id = r.id
            and ra.agent_id = (select auth.uid())
            and ra.unassigned_at is null
        )
      )
  )
);

drop policy if exists media_insert on public.report_media;
create policy media_insert
on public.report_media
for insert
to authenticated
with check (
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
);

drop policy if exists report_media_storage_insert on storage.objects;
create policy report_media_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-media'
  and lower(storage.extension(name)) in ('mp4','webm','mov','m4v')
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
);

alter table public.reports drop constraint if exists reports_citizen_id_fkey;
alter table public.reports drop column if exists citizen_id;
