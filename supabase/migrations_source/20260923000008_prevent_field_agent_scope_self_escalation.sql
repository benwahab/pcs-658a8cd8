drop policy if exists field_agents_agency_manage on public.field_agents;

create policy field_agents_self_update on public.field_agents
for update to authenticated
using (user_id=(select auth.uid()))
with check (
  user_id=(select auth.uid())
  and organization_id is not distinct from (select fa.organization_id from public.field_agents fa where fa.id=field_agents.id)
  and organization_unit_id is not distinct from (select fa.organization_unit_id from public.field_agents fa where fa.id=field_agents.id)
  and mairie_id is not distinct from (select fa.mairie_id from public.field_agents fa where fa.id=field_agents.id)
  and is_active is not distinct from (select fa.is_active from public.field_agents fa where fa.id=field_agents.id)
  and matricule is not distinct from (select fa.matricule from public.field_agents fa where fa.id=field_agents.id)
);

create policy field_agents_staff_manage on public.field_agents
for all to authenticated
using (private.is_staff())
with check (private.is_staff());

create policy field_agents_mairie_manage on public.field_agents
for all to authenticated
using (mairie_id is not null and mairie_id=private.my_mairie_id())
with check (
  mairie_id is not null and mairie_id=private.my_mairie_id()
  and organization_id is null and organization_unit_id is null
);

create policy field_agents_agency_manage on public.field_agents
for update to authenticated
using (agency_can_manage_agent(id))
with check (
  mairie_id is null
  and agency_can_manage_agent(id)
  and organization_id is not null
  and organization_unit_id is not null
);
