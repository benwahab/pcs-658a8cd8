drop policy if exists reports_mairie_update_commune on public.reports;

create policy reports_mairie_update_commune on public.reports
for update to authenticated
using (
  private.is_staff()
  or exists (
    select 1 from public.mairies m
    where m.id=private.my_mairie_id()
      and m.account_user_id=(select auth.uid())
      and m.is_active
      and m.commune_id=reports.commune_id
  )
)
with check (
  private.is_staff()
  or (
    exists (
      select 1 from public.mairies m
      where m.id=private.my_mairie_id()
        and m.account_user_id=(select auth.uid())
        and m.is_active
        and m.commune_id=reports.commune_id
    )
    and status is not distinct from (select r0.status from public.reports r0 where r0.id=reports.id)
    and citizen_id is not distinct from (select r0.citizen_id from public.reports r0 where r0.id=reports.id)
    and reference_code is not distinct from (select r0.reference_code from public.reports r0 where r0.id=reports.id)
    and category_id is not distinct from (select r0.category_id from public.reports r0 where r0.id=reports.id)
    and latitude is not distinct from (select r0.latitude from public.reports r0 where r0.id=reports.id)
    and longitude is not distinct from (select r0.longitude from public.reports r0 where r0.id=reports.id)
    and commune_id is not distinct from (select r0.commune_id from public.reports r0 where r0.id=reports.id)
    and region_id is not distinct from (select r0.region_id from public.reports r0 where r0.id=reports.id)
    and resolved_at is not distinct from (select r0.resolved_at from public.reports r0 where r0.id=reports.id)
    and created_at is not distinct from (select r0.created_at from public.reports r0 where r0.id=reports.id)
    and is_public is not distinct from (select r0.is_public from public.reports r0 where r0.id=reports.id)
  )
);
