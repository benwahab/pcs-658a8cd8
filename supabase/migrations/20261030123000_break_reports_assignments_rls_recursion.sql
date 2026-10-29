-- Avoid the remaining reports -> report_assignments -> reports RLS recursion for field agents.
create or replace function private.agent_can_view_report(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.report_assignments ra
    join public.field_agents fa on fa.user_id = ra.agent_id
    where ra.report_id = p_report_id
      and ra.agent_id = (select auth.uid())
      and ra.unassigned_at is null
      and fa.is_active = true
  );
$function$;

revoke all on function private.agent_can_view_report(uuid) from public;
grant execute on function private.agent_can_view_report(uuid) to authenticated;

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
  or private.agent_can_view_report(id)
);
