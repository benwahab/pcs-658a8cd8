-- PCS: Mairie transfers go to the central organization only.
-- The central office accepts the transfer and chooses an agency afterwards.
-- The agency then chooses the field agent through agency_assign_report_to_agent.

create or replace function public.list_mairie_transmission_targets()
returns table (
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
    central.id,
    central.name,
    central.code,
    central.unit_type,
    m.commune_id,
    c.name
  from public.mairies m
  join public.communes c on c.id = m.commune_id and c.is_active = true
  join public.organizations o
    on o.is_active = true
   and upper(o.code) in ('NIGELEC', 'NDE')
  join public.organization_units central
    on central.organization_id = o.id
   and central.unit_type = 'central'
   and central.is_active = true
  where m.account_user_id = (select auth.uid())
    and m.is_active = true
  order by case upper(o.code) when 'NIGELEC' then 1 when 'NDE' then 2 else 9 end;
$function$;

create or replace function public.mairie_transmit_report(
  p_report_id uuid,
  p_organization_id uuid,
  p_organization_unit_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'private'
as $function$
declare
  v_transfer_id uuid;
  v_mairie_id uuid;
  v_commune_id uuid;
  v_reference text;
begin
  if (select auth.uid()) is null then
    raise exception 'Session requise.';
  end if;

  select m.id, m.commune_id, r.reference_code
    into v_mairie_id, v_commune_id, v_reference
  from public.mairies m
  join public.reports r on r.commune_id = m.commune_id
  where r.id = p_report_id
    and m.account_user_id = (select auth.uid())
    and m.is_active
  for update of r;

  if v_mairie_id is null then
    raise exception 'La mairie ne peut transmettre que ses signalements communaux.';
  end if;

  if not exists (
    select 1
    from public.organization_units central
    join public.organizations o on o.id = central.organization_id
    where central.id = p_organization_unit_id
      and central.organization_id = p_organization_id
      and central.unit_type = 'central'
      and central.is_active
      and o.is_active
      and upper(o.code) in ('NIGELEC', 'NDE')
  ) then
    raise exception 'La mairie doit transmettre uniquement à la centrale NIGELEC ou NDE.';
  end if;

  if exists (
    select 1
    from public.report_organization_transfers
    where report_id = p_report_id
      and status in ('pending', 'accepted', 'completed')
  ) then
    raise exception 'Ce signalement a déjà été transmis ou pris en charge par une organisation.';
  end if;

  insert into public.report_organization_transfers (
    report_id,
    organization_id,
    organization_unit_id,
    from_mairie_id,
    transmitted_by,
    response_note
  )
  values (
    p_report_id,
    p_organization_id,
    p_organization_unit_id,
    v_mairie_id,
    (select auth.uid()),
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_transfer_id;

  insert into public.notifications(user_id, report_id, type, title, body)
  select distinct
    ou.user_id,
    p_report_id,
    'organization_transfer',
    'Nouveau signalement transmis à la centrale',
    'Le signalement ' || coalesce(v_reference, p_report_id::text) ||
      ' a été transmis à la centrale ' || o.name ||
      '. La centrale choisira ensuite l''agence locale compétente.'
  from public.organization_users ou
  join public.organizations o on o.id = p_organization_id
  where ou.organization_id = p_organization_id
    and ou.is_active
    and ou.role in ('admin', 'supervisor')
    and (
      ou.unit_id = p_organization_unit_id
      or (
        ou.unit_id is null
        and exists (
          select 1 from public.organization_units central
          where central.organization_id = ou.organization_id
            and central.unit_type = 'central'
            and central.is_active
        )
      )
      or exists (
        select 1 from public.organization_units member_unit
        where member_unit.id = ou.unit_id
          and member_unit.organization_id = ou.organization_id
          and member_unit.unit_type = 'central'
          and member_unit.is_active
      )
    );

  return v_transfer_id;
end;
$function$;

create or replace function public.organization_accept_transfer(
  p_transfer_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'private'
as $function$
declare
  v_transfer public.report_organization_transfers%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Session requise.';
  end if;

  select t.* into v_transfer
  from public.report_organization_transfers t
  where t.id = p_transfer_id
    and t.status = 'pending'
  for update;

  if v_transfer.id is null then
    raise exception 'Transmission introuvable ou déjà traitée.';
  end if;

  if not exists (
    select 1
    from public.organization_users ou
    join public.organization_units central
      on central.id = ou.unit_id
     and central.organization_id = ou.organization_id
    where ou.user_id = (select auth.uid())
      and ou.organization_id = v_transfer.organization_id
      and ou.unit_id = v_transfer.organization_unit_id
      and ou.is_active
      and ou.role in ('admin', 'supervisor')
      and central.unit_type = 'central'
      and central.is_active
  ) then
    raise exception 'Seule la centrale de l''organisation destinataire peut accepter cette transmission.';
  end if;

  update public.report_organization_transfers
  set status = 'accepted',
      responded_by = (select auth.uid()),
      responded_at = now(),
      response_note = nullif(trim(coalesce(p_note, '')), ''),
      updated_at = now()
  where id = p_transfer_id;

  insert into public.notifications(user_id, report_id, type, title, body)
  select
    m.account_user_id,
    v_transfer.report_id,
    'organization_transfer_response',
    'Transmission acceptée par la centrale',
    'La centrale ' || o.name ||
      ' a accepté le signalement ' || coalesce(r.reference_code, v_transfer.report_id::text) ||
      '. Elle va maintenant choisir l''agence locale chargée de l''intervention.'
  from public.mairies m
  join public.reports r on r.id = v_transfer.report_id
  join public.organizations o on o.id = v_transfer.organization_id
  where m.id = v_transfer.from_mairie_id
    and m.is_active
    and m.account_user_id is not null;

  return p_transfer_id;
end;
$function$;

create or replace function public.organization_assign_agency(
  p_transfer_id uuid,
  p_agency_unit_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'private'
as $function$
declare
  v_transfer public.report_organization_transfers%rowtype;
  v_assignment uuid;
  v_reference text;
begin
  select t.* into v_transfer
  from public.report_organization_transfers t
  where t.id = p_transfer_id
    and t.status = 'accepted'
  for update;

  if v_transfer.id is null then
    raise exception 'La transmission doit être acceptée avant attribution à une agence.';
  end if;

  if not exists (
    select 1
    from public.organization_users ou
    join public.organization_units central
      on central.id = ou.unit_id
     and central.organization_id = ou.organization_id
    where ou.user_id = (select auth.uid())
      and ou.organization_id = v_transfer.organization_id
      and ou.unit_id = v_transfer.organization_unit_id
      and ou.is_active
      and ou.role in ('admin', 'supervisor')
      and central.unit_type = 'central'
      and central.is_active
  ) then
    raise exception 'Seule la centrale de l''organisation peut choisir l''agence.';
  end if;

  if not exists (
    select 1
    from public.organization_units agency
    join public.organization_units central
      on central.id = agency.parent_unit_id
     and central.organization_id = agency.organization_id
     and central.unit_type = 'central'
     and central.organization_id = v_transfer.organization_id
    join public.reports r on r.id = v_transfer.report_id
    where agency.id = p_agency_unit_id
      and agency.unit_type = 'agency'
      and agency.is_active
      and (
        agency.commune_id = r.commune_id
        or exists (
          select 1 from public.unit_communes uc
          where uc.unit_id = agency.id
            and uc.commune_id = r.commune_id
        )
      )
  ) then
    raise exception 'Choisissez une agence active de votre organisation qui dessert la localité du signalement.';
  end if;

  if exists (
    select 1
    from public.report_unit_assignments rua
    where rua.report_id = v_transfer.report_id
      and rua.unassigned_at is null
      and rua.status in ('assigned', 'accepted', 'in_progress')
  ) then
    raise exception 'Une mission active existe déjà pour ce signalement.';
  end if;

  insert into public.report_unit_assignments (
    report_id, organization_id, unit_id, assigned_by, mission_note
  )
  values (
    v_transfer.report_id,
    v_transfer.organization_id,
    p_agency_unit_id,
    (select auth.uid()),
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_assignment;

  update public.report_organization_transfers
  set status = 'completed',
      organization_unit_id = p_agency_unit_id,
      updated_at = now()
  where id = p_transfer_id;

  select reference_code into v_reference
  from public.reports where id = v_transfer.report_id;

  insert into public.notifications(user_id, report_id, type, title, body)
  select distinct
    ou.user_id,
    v_transfer.report_id,
    'agency_assignment',
    'Nouveau signalement à traiter',
    'Le signalement ' || coalesce(v_reference, v_transfer.report_id::text) ||
      ' a été attribué à votre agence par la centrale.'
  from public.organization_users ou
  where ou.organization_id = v_transfer.organization_id
    and ou.unit_id = p_agency_unit_id
    and ou.is_active
    and ou.role in ('admin', 'supervisor');

  return v_assignment;
end;
$function$;

revoke all on function public.list_mairie_transmission_targets() from public, anon;
grant execute on function public.list_mairie_transmission_targets() to authenticated;
revoke all on function public.mairie_transmit_report(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.mairie_transmit_report(uuid, uuid, uuid, text) to authenticated;
revoke all on function public.organization_accept_transfer(uuid, text) from public, anon;
grant execute on function public.organization_accept_transfer(uuid, text) to authenticated;
revoke all on function public.organization_assign_agency(uuid, uuid, text) from public, anon;
grant execute on function public.organization_assign_agency(uuid, uuid, text) to authenticated;
