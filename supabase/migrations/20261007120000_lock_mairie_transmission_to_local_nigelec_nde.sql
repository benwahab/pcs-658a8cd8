-- PCS: lock mairie transmission to the NIGELEC/NDE unit serving the mairie commune.
-- The organization remains the receiver of the transfer; the local unit is the mandatory territorial target.

alter table public.report_organization_transfers
  add column if not exists organization_unit_id uuid references public.organization_units(id) on delete restrict;

create index if not exists report_org_transfers_target_unit_idx
  on public.report_organization_transfers (organization_unit_id);

create unique index if not exists organization_units_active_org_commune_uidx
  on public.organization_units (organization_id, commune_id)
  where commune_id is not null and is_active = true;

drop function if exists public.mairie_transmit_report(uuid, uuid, text);

create or replace function public.list_mairie_transmission_targets()
returns table(
  organization_id uuid,
  organization_name text,
  organization_code text,
  organization_type text,
  organization_unit_id uuid,
  organization_unit_name text,
  organization_unit_code text,
  organization_unit_type text,
  commune_id uuid,
  commune_name text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    o.id,
    o.name,
    o.code,
    o.type,
    u.id,
    u.name,
    u.code,
    u.unit_type,
    u.commune_id,
    c.name
  from public.mairies m
  join public.organization_units u
    on u.commune_id = m.commune_id
   and u.is_active = true
  join public.organizations o
    on o.id = u.organization_id
   and o.is_active = true
   and upper(o.code) in ('NIGELEC', 'NDE')
  join public.communes c
    on c.id = u.commune_id
   and c.is_active = true
  where m.account_user_id = (select auth.uid())
    and m.is_active = true
  order by
    case upper(o.code) when 'NIGELEC' then 1 when 'NDE' then 2 else 9 end,
    u.name;
$function$;

revoke execute on function public.list_mairie_transmission_targets() from public, anon;
grant execute on function public.list_mairie_transmission_targets() to authenticated;

create or replace function public.mairie_transmit_report(
  p_report_id uuid,
  p_organization_id uuid,
  p_organization_unit_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_transfer_id uuid;
  v_mairie_id uuid;
  v_mairie_commune_id uuid;
  v_reference text;
begin
  if (select auth.uid()) is null then
    raise exception 'Session requise.';
  end if;

  select m.id, m.commune_id, r.reference_code
    into v_mairie_id, v_mairie_commune_id, v_reference
  from public.mairies m
  join public.reports r
    on r.commune_id = m.commune_id
  where r.id = p_report_id
    and m.account_user_id = (select auth.uid())
    and m.is_active = true
  for update of r;

  if v_mairie_id is null then
    raise exception 'La mairie ne peut transmettre que ses signalements communaux';
  end if;

  if not exists (
    select 1
    from public.organization_units u
    join public.organizations o on o.id = u.organization_id
    where u.id = p_organization_unit_id
      and u.organization_id = p_organization_id
      and u.commune_id = v_mairie_commune_id
      and u.is_active = true
      and o.id = p_organization_id
      and o.is_active = true
      and upper(o.code) in ('NIGELEC', 'NDE')
  ) then
    raise exception 'La mairie ne peut transmettre qu''à NIGELEC ou NDE de sa propre localité';
  end if;

  if exists (
    select 1
    from public.report_organization_transfers
    where report_id = p_report_id
      and status = 'pending'
  ) then
    raise exception 'Une transmission est déjà en attente pour ce signalement';
  end if;

  insert into public.report_organization_transfers
    (report_id, organization_id, organization_unit_id, from_mairie_id, transmitted_by, response_note)
  values
    (p_report_id, p_organization_id, p_organization_unit_id, v_mairie_id, (select auth.uid()), nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_transfer_id;

  insert into public.notifications(user_id, report_id, type, title, body)
  select distinct ou.user_id,
         p_report_id,
         'organization_transfer',
         'Nouveau signalement transmis',
         'Le signalement ' || coalesce(v_reference, p_report_id::text) ||
         ' a été transmis à ' || o.name || ' pour la localité de la mairie.'
  from public.organization_users ou
  join public.organizations o on o.id = p_organization_id
  where ou.organization_id = p_organization_id
    and ou.unit_id is null
    and ou.is_active
    and ou.role in ('admin', 'supervisor');

  return v_transfer_id;
end;
$function$;

revoke execute on function public.mairie_transmit_report(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.mairie_transmit_report(uuid, uuid, uuid, text) to authenticated;