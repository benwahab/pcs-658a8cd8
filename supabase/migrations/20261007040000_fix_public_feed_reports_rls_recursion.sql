-- Keep scoped report access for authenticated staff/mairie/agents only.
-- Anonymous public-feed queries must never enter the scoped assignment branch.
drop policy if exists reports_select_scoped on public.reports;

create policy reports_select_scoped
on public.reports
for select
to authenticated
using (
  private.is_staff()
  or exists (
    select 1
    from public.mairies m
    where m.account_user_id = (select auth.uid())
      and m.commune_id = reports.commune_id
      and m.is_active = true
  )
  or exists (
    select 1
    from public.report_assignments ra
    join public.field_agents fa
      on fa.user_id = ra.agent_id
     and fa.is_active = true
    where ra.report_id = reports.id
      and ra.agent_id = (select auth.uid())
      and ra.unassigned_at is null
  )
);