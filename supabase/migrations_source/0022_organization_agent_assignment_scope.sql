-- PCS 0022: raccordement structurel organisation -> unités -> agents
-- Aucun compte, agence opérationnelle ou mission réelle n'est créé ici.

alter table public.field_agents
  alter column mairie_id drop not null;

alter table public.report_assignments
  add column if not exists unit_assignment_id uuid
    references public.report_unit_assignments(id) on delete set null;

create index if not exists report_assignments_unit_assignment_idx
  on public.report_assignments(unit_assignment_id);

alter table public.field_agents
  add constraint field_agents_owner_scope_ck
  check (
    (mairie_id is not null and organization_id is null and organization_unit_id is null)
    or
    (mairie_id is null and organization_id is not null and organization_unit_id is not null)
  );

create or replace function private.validate_field_agent_organization_scope()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  unit_org uuid;
begin
  if new.organization_unit_id is null then
    return new;
  end if;
  select organization_id into unit_org
  from public.organization_units
  where id = new.organization_unit_id and is_active;
  if unit_org is null then
    raise exception 'Unité organisationnelle invalide ou inactive';
  end if;
  if new.organization_id is distinct from unit_org then
    raise exception 'L''agent doit appartenir à la même organisation que son unité';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_field_agent_organization_scope_trigger on public.field_agents;
create trigger validate_field_agent_organization_scope_trigger
before insert or update of organization_id, organization_unit_id
on public.field_agents for each row
execute function private.validate_field_agent_organization_scope();

create or replace function private.validate_report_assignment_unit_scope()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare agent_unit uuid;
begin
  if new.unit_assignment_id is null or new.agent_id is null then return new; end if;
  select organization_unit_id into agent_unit
  from public.field_agents where user_id = new.agent_id and is_active;
  if agent_unit is null then
    raise exception 'L''agent sélectionné n''est pas rattaché à une unité organisationnelle active';
  end if;
  if not exists (
    select 1 from public.report_unit_assignments rua
    where rua.id = new.unit_assignment_id
      and rua.unit_id = agent_unit
      and rua.report_id = new.report_id
      and rua.unassigned_at is null
  ) then
    raise exception 'La mission agent doit appartenir à la même unité organisationnelle';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_report_assignment_unit_scope_trigger on public.report_assignments;
create trigger validate_report_assignment_unit_scope_trigger
before insert or update of unit_assignment_id, agent_id, report_id
on public.report_assignments for each row
execute function private.validate_report_assignment_unit_scope();

drop policy if exists organization_users_self_read on public.organization_users;
create policy organization_users_self_read
on public.organization_users for select to authenticated
using (user_id = auth.uid() or private.is_staff());

drop policy if exists organization_units_members_read on public.organization_units;
create policy organization_units_members_read
on public.organization_units for select to authenticated
using (
  private.is_staff()
  or exists (
    select 1 from public.organization_users ou
    where ou.user_id = auth.uid()
      and ou.organization_id = organization_units.organization_id
      and ou.is_active
      and (ou.unit_id is null or ou.unit_id = organization_units.id)
  )
);

drop policy if exists organizations_members_read on public.organizations;
create policy organizations_members_read
on public.organizations for select to authenticated
using (
  private.is_staff()
  or exists (
    select 1 from public.organization_users ou
    where ou.user_id = auth.uid()
      and ou.organization_id = organizations.id
      and ou.is_active
  )
);