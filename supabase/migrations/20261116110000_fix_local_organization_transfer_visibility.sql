-- PCS: repair the complete local transfer flow for both NIGELEC and NDE.
-- Central organization accounts (organization_users.unit_id IS NULL) can see and
-- accept transfers addressed to their local agency; acceptance creates the
-- report_unit_assignments row for that exact destination unit.

drop policy if exists report_org_transfers_scoped_read on public.report_organization_transfers;
drop policy if exists report_org_transfers_org_read on public.report_organization_transfers;

create policy report_org_transfers_scoped_read
on public.report_organization_transfers
for select
using (
  private.is_staff()
  or exists (
    select 1
    from public.mairies m
    where m.id = report_organization_transfers.from_mairie_id
      and m.account_user_id = (select auth.uid())
      and m.is_active
  )
  or exists (
    select 1
    from public.organization_users ou
    where ou.user_id = (select auth.uid())
      and ou.organization_id = report_organization_transfers.organization_id
      and ou.is_active
      and (
        -- Local agency accounts see only transfers addressed to their own unit.
        ou.unit_id = report_organization_transfers.organization_unit_id
        or
        -- Central accounts are represented either by a NULL unit_id or by
        -- an explicit active central unit, and can oversee all org transfers.
        (
          ou.unit_id is null
          and exists (
            select 1
            from public.organization_units central_unit
            where central_unit.organization_id = ou.organization_id
              and central_unit.unit_type = 'central'
              and central_unit.is_active
          )
        )
        or exists (
          select 1
          from public.organization_units member_unit
          where member_unit.id = ou.unit_id
            and member_unit.organization_id = ou.organization_id
            and member_unit.unit_type = 'central'
            and member_unit.is_active
        )
      )
  )
);

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
as $$
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
    from public.organization_units target_unit
    join public.organizations o on o.id = target_unit.organization_id
    where target_unit.id = p_organization_unit_id
      and target_unit.organization_id = p_organization_id
      and target_unit.commune_id = v_commune_id
      and target_unit.unit_type = 'agency'
      and target_unit.is_active
      and o.is_active
      and upper(o.code) in ('NIGELEC', 'NDE')
  ) then
    raise exception 'La mairie ne peut transmettre qu''à l''agence NIGELEC ou NDE de sa propre localité.';
  end if;

  if exists (
    select 1
    from public.report_organization_transfers
    where report_id = p_report_id
      and status = 'pending'
  ) then
    raise exception 'Une transmission est déjà en attente pour ce signalement.';
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

  -- Notify both the exact local unit and its organization's central managers.
  insert into public.notifications(user_id, report_id, type, title, body)
  select distinct
    ou.user_id,
    p_report_id,
    'organization_transfer',
    'Nouveau signalement transmis',
    'Le signalement ' || coalesce(v_reference, p_report_id::text) ||
      ' a été transmis à ' || o.name || ' — ' || target_unit.name || '.'
  from public.organization_users ou
  join public.organizations o on o.id = p_organization_id
  join public.organization_units target_unit
    on target_unit.id = p_organization_unit_id
   and target_unit.organization_id = p_organization_id
  where ou.organization_id = p_organization_id
    and ou.is_active
    and ou.role in ('admin', 'supervisor')
    and (
      ou.unit_id = p_organization_unit_id
      or (
        ou.unit_id is null
        and exists (
          select 1
          from public.organization_units central_unit
          where central_unit.organization_id = ou.organization_id
            and central_unit.unit_type = 'central'
            and central_unit.is_active
        )
      )
      or exists (
        select 1
        from public.organization_units member_unit
        where member_unit.id = ou.unit_id
          and member_unit.organization_id = ou.organization_id
          and member_unit.unit_type = 'central'
          and member_unit.is_active
      )
    );

  return v_transfer_id;
end;
$$;

revoke execute on function public.mairie_transmit_report(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.mairie_transmit_report(uuid, uuid, uuid, text) to authenticated;

create or replace function public.organization_accept_transfer(
  p_transfer_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  v_transfer public.report_organization_transfers%rowtype;
  v_assignment uuid;
  v_is_central boolean;
  v_is_local boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Session requise.';
  end if;

  select t.*
    into v_transfer
  from public.report_organization_transfers t
  where t.id = p_transfer_id
    and t.status = 'pending'
  for update;

  if v_transfer.id is null then
    raise exception 'Transmission introuvable ou déjà traitée.';
  end if;

  select exists (
    select 1
    from public.organization_users ou
    where ou.user_id = (select auth.uid())
      and ou.organization_id = v_transfer.organization_id
      and ou.is_active
      and ou.role in ('admin', 'supervisor')
      and (
        (
          ou.unit_id is null
          and exists (
            select 1
            from public.organization_units central_unit
            where central_unit.organization_id = ou.organization_id
              and central_unit.unit_type = 'central'
              and central_unit.is_active
          )
        )
        or exists (
          select 1
          from public.organization_units member_unit
          where member_unit.id = ou.unit_id
            and member_unit.organization_id = ou.organization_id
            and member_unit.unit_type = 'central'
            and member_unit.is_active
        )
      )
  ) into v_is_central;

  select exists (
    select 1
    from public.organization_users ou
    join public.organization_units target_unit
      on target_unit.id = ou.unit_id
     and target_unit.organization_id = ou.organization_id
    where ou.user_id = (select auth.uid())
      and ou.organization_id = v_transfer.organization_id
      and ou.unit_id = v_transfer.organization_unit_id
      and ou.is_active
      and ou.role in ('admin', 'supervisor')
      and target_unit.unit_type = 'agency'
      and target_unit.is_active
  ) into v_is_local;

  if not v_is_central and not v_is_local then
    raise exception 'Accès central ou responsable de l''agence destinataire requis.';
  end if;

  if v_transfer.organization_unit_id is not null then
    if not exists (
      select 1
      from public.organization_units target_unit
      where target_unit.id = v_transfer.organization_unit_id
        and target_unit.organization_id = v_transfer.organization_id
        and target_unit.unit_type = 'agency'
        and target_unit.is_active
    ) then
      raise exception 'L''agence destinataire de cette transmission est inactive ou introuvable.';
    end if;

    if exists (
      select 1
      from public.report_unit_assignments rua
      where rua.report_id = v_transfer.report_id
        and rua.organization_id = v_transfer.organization_id
        and rua.unit_id = v_transfer.organization_unit_id
        and rua.unassigned_at is null
        and rua.status in ('assigned', 'accepted', 'in_progress')
    ) then
      raise exception 'Une mission active existe déjà pour cette agence.';
    end if;

    insert into public.report_unit_assignments (
      report_id,
      organization_id,
      unit_id,
      assigned_by,
      mission_note
    )
    values (
      v_transfer.report_id,
      v_transfer.organization_id,
      v_transfer.organization_unit_id,
      (select auth.uid()),
      nullif(trim(coalesce(p_note, '')), '')
    )
    returning id into v_assignment;
  end if;

  update public.report_organization_transfers
  set status = 'accepted',
      responded_by = (select auth.uid()),
      responded_at = now(),
      response_note = nullif(trim(coalesce(p_note, '')), ''),
      updated_at = now()
  where id = p_transfer_id;

  insert into public.notifications(user_id, report_id, type, title, body)
  select distinct
    m.account_user_id,
    v_transfer.report_id,
    'organization_transfer_response',
    'Transmission acceptée',
    'La transmission du signalement ' || coalesce(r.reference_code, v_transfer.report_id::text) ||
      ' a été acceptée par ' || o.name || '. La mission a été envoyée à l''agence locale.'
  from public.mairies m
  join public.reports r on r.id = v_transfer.report_id
  join public.organizations o on o.id = v_transfer.organization_id
  where m.id = v_transfer.from_mairie_id
    and m.is_active
    and m.account_user_id is not null;

  return coalesce(v_assignment, p_transfer_id);
end;
$$;

revoke execute on function public.organization_accept_transfer(uuid, text) from public, anon;
grant execute on function public.organization_accept_transfer(uuid, text) to authenticated;
