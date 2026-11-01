-- Mairies may review resolution videos in their own commune, but must not
-- read pending/rejected citizen evidence before CST/moderator approval.
-- Keep public approved media access in the dedicated public-read policies.
begin;

drop policy if exists media_select_scoped on public.report_media;
create policy media_select_scoped
on public.report_media
for select
to authenticated
using (
  private.is_staff()
  or (
    media_role = 'resolution_video'
    and exists (
      select 1
      from public.reports r
      join public.mairies m on m.commune_id = r.commune_id
      where r.id = report_media.report_id
        and m.account_user_id = (select auth.uid())
        and m.is_active = true
    )
  )
  or exists (
    select 1
    from public.report_assignments ra
    join public.field_agents fa
      on fa.user_id = ra.agent_id
     and fa.is_active
    where ra.report_id = report_media.report_id
      and ra.agent_id = (select auth.uid())
      and ra.unassigned_at is null
  )
);

commit;
