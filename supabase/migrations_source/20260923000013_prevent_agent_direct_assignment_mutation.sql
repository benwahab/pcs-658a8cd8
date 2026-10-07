drop policy if exists assignments_mairie_update on public.report_assignments;

create policy assignments_mairie_update on public.report_assignments
for update to authenticated
using (
  assigned_by=(select auth.uid())
  or private.is_staff()
)
with check (
  private.is_staff()
  or exists (
    select 1
    from public.reports r
    join public.mairies m on m.commune_id=r.commune_id
    join public.field_agents fa on fa.user_id=report_assignments.agent_id
      and fa.mairie_id=m.id
      and fa.is_active
    where r.id=report_assignments.report_id
      and m.account_user_id=(select auth.uid())
      and m.is_active
  )
);
