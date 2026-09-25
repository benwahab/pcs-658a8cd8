drop policy if exists media_insert on public.report_media;
drop policy if exists media_insert_agent_resolution on public.report_media;
drop policy if exists media_update_owner on public.report_media;
drop policy if exists media_delete_owner on public.report_media;

create policy media_insert on public.report_media
for insert to authenticated
with check (
  uploaded_by=(select auth.uid())
  and (
    (
      media_role='citizen_evidence'
      and exists (
        select 1 from public.reports r
        where r.id=report_media.report_id and r.citizen_id=(select auth.uid())
      )
    )
    or (
      media_role='resolution_video'
      and media_type like 'video/%'
      and captured_latitude is not null
      and captured_longitude is not null
      and exists (
        select 1 from public.report_assignments ra
        join public.reports r on r.id=ra.report_id
        where ra.report_id=report_media.report_id
          and ra.agent_id=(select auth.uid())
          and ra.unassigned_at is null
          and ra.assignment_status in ('assigned','accepted','in_progress')
          and r.status='in_progress'
      )
    )
  )
);

create policy media_update_staff_only on public.report_media
for update to authenticated
using (private.is_staff())
with check (private.is_staff());

create policy media_delete_staff_only on public.report_media
for delete to authenticated
using (private.is_staff());
