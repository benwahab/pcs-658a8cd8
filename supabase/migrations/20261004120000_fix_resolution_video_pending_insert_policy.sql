-- Allow only assigned agents to insert resolution-video metadata in the pending state.
-- Publication remains blocked until the responsible mairie approves the video.
drop policy if exists media_insert on public.report_media;
create policy media_insert
on public.report_media
for insert
to authenticated
with check (
  media_role = 'resolution_video'
  and moderation_status = 'pending'
  and media_type in ('video/mp4', 'video/webm', 'video/quicktime')
  and file_size is not null
  and file_size between 1 and 104857600
  and captured_latitude is not null
  and captured_longitude is not null
  and accuracy_m is not null
  and accuracy_m between 0 and 20
  and uploaded_by = auth.uid()
  and exists (
    select 1
    from public.report_assignments ra
    join public.reports r on r.id = ra.report_id
    where ra.report_id = report_media.report_id
      and ra.agent_id = auth.uid()
      and ra.unassigned_at is null
      and ra.assignment_status in ('assigned', 'accepted', 'in_progress')
      and r.status = 'in_progress'
      and r.latitude is not null
      and r.longitude is not null
      and public.earth_distance(
        public.ll_to_earth(r.latitude, r.longitude),
        public.ll_to_earth(report_media.captured_latitude, report_media.captured_longitude)
      ) <= 20
  )
);
