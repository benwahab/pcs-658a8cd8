-- PCS: one mairie account per commune, not per region.
-- Keep the commune uniqueness rule and remove the legacy one-mairie-per-region constraint.

alter table public.mairies
  drop constraint if exists mairies_region_id_key;

drop policy if exists assignments_mairie_insert on public.report_assignments;
create policy assignments_mairie_insert
on public.report_assignments
for insert
with check (
  assigned_by = auth.uid()
  and exists (
    select 1
    from public.reports r
    join public.mairies m on m.commune_id = r.commune_id
    join public.field_agents fa
      on fa.user_id = report_assignments.agent_id
     and fa.mairie_id = m.id
     and fa.is_active
    where r.id = report_assignments.report_id
      and m.account_user_id = auth.uid()
      and m.is_active
  )
);

drop policy if exists assignments_mairie_or_agent on public.report_assignments;
create policy assignments_mairie_or_agent
on public.report_assignments
for select
using (
  agent_id = auth.uid()
  or assigned_by = auth.uid()
  or exists (
    select 1
    from public.reports r
    join public.mairies m on m.commune_id = r.commune_id
    where r.id = report_assignments.report_id
      and m.account_user_id = auth.uid()
      and m.is_active
  )
  or private.is_staff()
);

drop policy if exists assignments_mairie_update on public.report_assignments;
create policy assignments_mairie_update
on public.report_assignments
for update
using (
  agent_id = auth.uid()
  or assigned_by = auth.uid()
  or private.is_staff()
)
with check (
  agent_id = auth.uid()
  or private.is_staff()
  or exists (
    select 1
    from public.reports r
    join public.mairies m on m.commune_id = r.commune_id
    join public.field_agents fa
      on fa.user_id = report_assignments.agent_id
     and fa.mairie_id = m.id
     and fa.is_active
    where r.id = report_assignments.report_id
      and m.account_user_id = auth.uid()
      and m.is_active
  )
);

drop policy if exists confirmations_read on public.report_confirmations;
create policy confirmations_read
on public.report_confirmations
for select
using (
  citizen_id = auth.uid()
  or exists (
    select 1
    from public.reports r
    join public.mairies m on m.commune_id = r.commune_id
    where r.id = report_confirmations.report_id
      and m.account_user_id = auth.uid()
      and m.is_active
  )
  or private.is_staff()
);

drop policy if exists verification_read on public.report_field_verifications;
create policy verification_read
on public.report_field_verifications
for select
using (
  agent_id = auth.uid()
  or exists (
    select 1
    from public.reports r
    join public.mairies m on m.commune_id = r.commune_id
    where r.id = report_field_verifications.report_id
      and m.account_user_id = auth.uid()
      and m.is_active
  )
  or private.is_staff()
  or exists (
    select 1
    from public.reports r
    where r.id = report_field_verifications.report_id
      and r.citizen_id = auth.uid()
  )
);

drop policy if exists media_read on public.report_media;
create policy media_read
on public.report_media
for select
using (
  exists (
    select 1
    from public.reports r
    where r.id = report_media.report_id
      and (
        r.citizen_id = auth.uid()
        or private.is_staff()
        or exists (
          select 1
          from public.mairies m
          where m.account_user_id = auth.uid()
            and m.commune_id = r.commune_id
            and m.is_active
        )
        or exists (
          select 1
          from public.report_assignments ra
          where ra.report_id = r.id
            and ra.agent_id = auth.uid()
            and ra.unassigned_at is null
        )
      )
  )
);
