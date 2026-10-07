-- Restore the public read path for approved citizen/resolution media.
-- report_media is RLS-protected; the public feed needs only approved media
-- attached to reports explicitly marked public.
create policy report_media_public_read
on public.report_media
for select
to anon, authenticated
using (
  moderation_status = 'approved'
  and media_role in ('citizen_evidence', 'resolution_video')
  and exists (
    select 1
    from public.reports r
    where r.id = report_media.report_id
      and r.is_public = true
  )
);
