drop policy if exists report_unit_assignments_unit_read on public.report_unit_assignments;
create policy report_unit_assignments_unit_read
on public.report_unit_assignments
for select
using (
  private.is_staff()
  or exists (
    select 1 from public.organization_users ou
    where ou.user_id=(select auth.uid())
      and ou.organization_id=report_unit_assignments.organization_id
      and ou.is_active
      and (
        ou.unit_id=report_unit_assignments.unit_id
        or exists (
          select 1 from public.organization_units central
          where central.id=ou.unit_id
            and central.organization_id=ou.organization_id
            and central.unit_type='central'
            and central.is_active
        )
      )
  )
);