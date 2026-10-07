drop policy if exists assignments_insert_mairie on public.report_assignments;
create policy assignments_insert_mairie on public.report_assignments for insert to authenticated
with check (assigned_by=(select auth.uid()) and exists (
  select 1 from public.reports r
  join public.mairies m on m.commune_id=r.commune_id
  join public.field_agents fa on fa.user_id=report_assignments.agent_id and fa.mairie_id=m.id and fa.is_active
  where r.id=report_assignments.report_id and m.account_user_id=(select auth.uid()) and m.is_active
));

drop policy if exists assignments_mairie_or_agent on public.report_assignments;
create policy assignments_mairie_or_agent on public.report_assignments for select to authenticated
using (
  agent_id=(select auth.uid()) or assigned_by=(select auth.uid())
  or exists (select 1 from public.reports r join public.mairies m on m.commune_id=r.commune_id
    where r.id=report_assignments.report_id and m.account_user_id=(select auth.uid()) and m.is_active)
  or private.is_staff()
);

drop policy if exists assignments_mairie_update on public.report_assignments;
create policy assignments_mairie_update on public.report_assignments for update to authenticated
using (agent_id=(select auth.uid()) or assigned_by=(select auth.uid()) or private.is_staff())
with check (
  agent_id=(select auth.uid()) or private.is_staff()
  or exists (
    select 1 from public.reports r
    join public.mairies m on m.commune_id=r.commune_id
    join public.field_agents fa on fa.user_id=report_assignments.agent_id and fa.mairie_id=m.id and fa.is_active
    where r.id=report_assignments.report_id and m.account_user_id=(select auth.uid()) and m.is_active
  )
);

drop policy if exists verification_insert on public.report_field_verifications;
create policy verification_insert on public.report_field_verifications for insert to authenticated
with check (
  agent_id=(select auth.uid()) and exists (
    select 1 from public.report_assignments ra
    where ra.id=report_field_verifications.assignment_id and ra.report_id=report_field_verifications.report_id
      and ra.agent_id=(select auth.uid()) and ra.unassigned_at is null
  )
);

drop policy if exists verification_read on public.report_field_verifications;
create policy verification_read on public.report_field_verifications for select to authenticated
using (
  agent_id=(select auth.uid())
  or exists (select 1 from public.reports r join public.mairies m on m.commune_id=r.commune_id
    where r.id=report_field_verifications.report_id and m.account_user_id=(select auth.uid()) and m.is_active)
  or private.is_staff()
  or exists (select 1 from public.reports r where r.id=report_field_verifications.report_id and r.citizen_id=(select auth.uid()))
);

drop policy if exists media_insert on public.report_media;
create policy media_insert on public.report_media for insert to authenticated
with check (
  media_role='citizen_evidence' and uploaded_by=(select auth.uid())
  and exists (select 1 from public.reports r where r.id=report_media.report_id and r.citizen_id=(select auth.uid()))
);

drop policy if exists media_insert_agent_resolution on public.report_media;
create policy media_insert_agent_resolution on public.report_media for insert to authenticated
with check (
  media_role='resolution_video' and uploaded_by=(select auth.uid()) and media_type like 'video/%'
  and exists (
    select 1 from public.report_assignments ra join public.reports r on r.id=ra.report_id
    where ra.report_id=report_media.report_id and ra.agent_id=(select auth.uid())
      and ra.unassigned_at is null and r.status='in_progress'
  )
);

drop policy if exists media_select_scoped on public.report_media;
create policy media_select_scoped on public.report_media for select to authenticated
using (
  exists (
    select 1 from public.reports r where r.id=report_media.report_id and (
      r.citizen_id=(select auth.uid()) or private.is_staff()
      or exists (select 1 from public.mairies m where m.account_user_id=(select auth.uid()) and m.commune_id=r.commune_id and m.is_active)
      or exists (select 1 from public.report_assignments ra where ra.report_id=r.id and ra.agent_id=(select auth.uid()) and ra.unassigned_at is null)
    )
  )
);

drop policy if exists reports_insert_citizen on public.reports;
create policy reports_insert_citizen on public.reports for insert to authenticated
with check (citizen_id=(select auth.uid()));
