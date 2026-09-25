drop policy if exists notifications_read on public.notifications;
drop policy if exists notifications_update on public.notifications;
create policy notifications_read on public.notifications for select to authenticated
using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists profiles_self on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_self on public.profiles for select to authenticated
using ((id = (select auth.uid())) or private.is_staff());
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists organizations_members_read on public.organizations;
create policy organizations_members_read on public.organizations for select to authenticated
using (private.is_staff() or exists (
  select 1 from public.organization_users ou
  where ou.user_id=(select auth.uid())
    and ou.organization_id=organizations.id
    and ou.is_active
));

drop policy if exists organization_units_members_read on public.organization_units;
create policy organization_units_members_read on public.organization_units for select to authenticated
using (private.is_staff() or exists (
  select 1 from public.organization_users ou
  where ou.user_id=(select auth.uid())
    and ou.organization_id=organization_units.organization_id
    and ou.is_active
    and (ou.unit_id is null or ou.unit_id=organization_units.id)
));

drop policy if exists report_org_transfers_org_read on public.report_organization_transfers;
create policy report_org_transfers_org_read on public.report_organization_transfers for select to authenticated
using (
  private.is_staff()
  or exists (
    select 1 from public.organization_users ou
    where ou.user_id=(select auth.uid())
      and ou.organization_id=report_organization_transfers.organization_id
      and ou.is_active
  )
  or exists (
    select 1 from public.mairies m
    where m.id=report_organization_transfers.from_mairie_id
      and m.account_user_id=(select auth.uid())
      and m.is_active
  )
);
