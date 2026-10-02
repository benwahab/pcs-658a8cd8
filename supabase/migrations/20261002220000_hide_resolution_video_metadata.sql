-- Resolution evidence belongs exclusively to the CST archive.
-- Exclude it from all ordinary report_media SELECT policies; permissive policies
-- are OR-combined by PostgreSQL, so every applicable policy must be narrowed.
drop policy if exists media_select_scoped on public.report_media;
create policy media_select_scoped
on public.report_media for select to authenticated
using (
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
);

drop policy if exists report_media_public_anon on public.report_media;
create policy report_media_public_anon
on public.report_media for select to anon
using (
  media_role is distinct from 'resolution_video'
  and moderation_status = 'approved'
  and exists (
    select 1 from public.reports r
    where r.id = report_media.report_id and r.is_public = true
  )
);

drop policy if exists report_media_public_read_authenticated on public.report_media;
create policy report_media_public_read_authenticated
on public.report_media for select to authenticated
using (
  media_role is distinct from 'resolution_video'
  and moderation_status = 'approved'
  and exists (
    select 1 from public.reports r
    where r.id = report_media.report_id and r.is_public = true
  )
);
