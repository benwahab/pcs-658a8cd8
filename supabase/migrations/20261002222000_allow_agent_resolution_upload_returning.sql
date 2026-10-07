-- The field agent needs the inserted media UUID to call agent_resolve_report.
-- Permit only that uploader, while still assigned to an in-progress report, to
-- read the minimal metadata row. Storage policies continue to deny video access.
drop policy if exists media_select_scoped on public.report_media;
create policy media_select_scoped
on public.report_media for select to authenticated
using (
  (
    media_role = 'resolution_video'
    and uploaded_by = auth.uid()
    and exists (
      select 1 from public.report_assignments ra
      join public.reports r on r.id = ra.report_id
      where ra.report_id = report_media.report_id
        and ra.agent_id = auth.uid()
        and ra.unassigned_at is null
        and ra.assignment_status in ('assigned','accepted','in_progress')
        and r.status = 'in_progress'
    )
  )
  or (
    media_role is distinct from 'resolution_video'
    and exists (
      select 1 from public.reports r
      where r.id = report_media.report_id
        and (
          private.is_staff()
          or exists (
            select 1 from public.mairies m
            where m.account_user_id = auth.uid()
              and m.commune_id = r.commune_id
              and m.is_active
          )
          or exists (
            select 1 from public.report_assignments ra
            where ra.report_id = r.id
              and ra.agent_id = auth.uid()
              and ra.unassigned_at is null
          )
        )
    )
  )
);
