-- Ensure central routing only assigns a report to an agency serving its commune.
-- Existing assignments and transfer records are not modified.
create or replace function public.organization_assign_agency(
  p_transfer_id uuid,
  p_agency_unit_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'private'
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
    raise exception 'La transmission doit être acceptée avant attribution';
  end if;

  if not exists (
    select 1
    from public.organization_users ou
    join public.organization_units central
      on central.id = ou.unit_id
     and central.organization_id = ou.organization_id
    where ou.user_id = auth.uid()
      and ou.organization_id = v_transfer.organization_id
      and ou.is_active
      and ou.role in ('admin', 'supervisor')
      and central.unit_type = 'central'
      and central.is_active
  ) then
    raise exception 'Seul le central de l’organisation peut attribuer une agence';
  end if;

  if not exists (
    select 1
    from public.organization_units u
    join public.organization_units central
      on central.id = u.parent_unit_id
     and central.organization_id = u.organization_id
     and central.unit_type = 'central'
     and central.organization_id = v_transfer.organization_id
    join public.reports r
      on r.id = v_transfer.report_id
    where u.id = p_agency_unit_id
      and u.unit_type = 'agency'
      and u.is_active
      and (
        u.commune_id = r.commune_id
        or exists (
          select 1
          from public.unit_communes uc
          where uc.unit_id = u.id
            and uc.commune_id = r.commune_id
        )
      )
  ) then
    raise exception 'L’agence doit appartenir à cette organisation et desservir la localité du signalement';
  end if;

  if exists (
    select 1
    from public.report_unit_assignments
    where report_id = v_transfer.report_id
      and unassigned_at is null
      and status in ('assigned', 'accepted', 'in_progress')
  ) then
    raise exception 'Une mission active existe déjà pour ce signalement';
  end if;

  insert into public.report_unit_assignments(
    report_id, organization_id, unit_id, assigned_by, mission_note
  )
  values (
    v_transfer.report_id,
    v_transfer.organization_id,
    p_agency_unit_id,
    auth.uid(),
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_assignment;

  update public.report_organization_transfers
  set status = 'completed', updated_at = now()
  where id = p_transfer_id;

  select reference_code into v_reference
  from public.reports
  where id = v_transfer.report_id;

  insert into public.notifications(user_id, report_id, type, title, body)
  select distinct
    ou.user_id,
    v_transfer.report_id,
    'agency_assignment',
    'Nouveau signalement à traiter',
    'Le signalement ' || coalesce(v_reference, v_transfer.report_id::text) ||
      ' a été attribué à votre agence.'
  from public.organization_users ou
  where ou.organization_id = v_transfer.organization_id
    and ou.unit_id = p_agency_unit_id
    and ou.is_active
    and ou.role in ('admin', 'supervisor');

  return v_assignment;
end
$function$;

do $$
begin
  if position(
    'uc.commune_id = r.commune_id'
    in pg_get_functiondef('public.organization_assign_agency(uuid,uuid,text)'::regprocedure)
  ) = 0 then
    raise exception 'Locality authorization guard was not installed';
  end if;
end;
$$;
