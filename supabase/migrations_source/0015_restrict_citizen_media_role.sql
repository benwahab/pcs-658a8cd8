-- Citizens may upload only their own evidence.
-- Resolution videos are reserved for the assigned field agent workflow.

drop policy if exists media_insert on public.report_media;

create policy media_insert
on public.report_media
for insert
with check (
  media_role = 'citizen_evidence'
  and uploaded_by = auth.uid()
  and exists (
    select 1
    from public.reports r
    where r.id = report_media.report_id
      and r.citizen_id = auth.uid()
  )
);
