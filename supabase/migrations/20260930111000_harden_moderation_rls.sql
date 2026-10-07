-- Harden media moderation boundaries.
-- Moderation status is server-controlled; authenticated clients must not update/delete media rows directly.
drop policy if exists media_update_staff_only on public.report_media;
create policy media_update_staff_only
on public.report_media
for update
to authenticated
using (false)
with check (false);

drop policy if exists media_delete_staff_only on public.report_media;
create policy media_delete_staff_only
on public.report_media
for delete
to authenticated
using (false);

-- Anonymous/public consumers may only see media that has passed moderation.
drop policy if exists report_media_public_anon on public.report_media;
create policy report_media_public_anon
on public.report_media
for select
to anon
using (
  moderation_status = 'approved'
  and exists (
    select 1
    from public.reports r
    where r.id = report_media.report_id
      and r.is_public = true
  )
);
