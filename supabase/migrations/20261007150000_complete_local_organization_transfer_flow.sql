drop policy if exists report_org_transfers_org_read on public.report_organization_transfers;
create policy report_org_transfers_scoped_read
on public.report_organization_transfers
for select
using (
  private.is_staff()
  or exists (
    select 1 from public.mairies m
    where m.id=report_organization_transfers.from_mairie_id
      and m.account_user_id=(select auth.uid()) and m.is_active
  )
  or exists (
    select 1
    from public.organization_users ou
    where ou.user_id=(select auth.uid())
      and ou.organization_id=report_organization_transfers.organization_id
      and ou.is_active
      and (
        (ou.unit_id is not null and ou.unit_id=report_organization_transfers.organization_unit_id)
        or (
          ou.unit_id is null
          and report_organization_transfers.organization_unit_id is null
          and exists (
            select 1 from public.organization_units u
            where u.id=ou.unit_id
              and u.organization_id=ou.organization_id
              and u.unit_type='central' and u.is_active
          )
        )
      )
  )
);

create or replace function public.mairie_transmit_report(
  p_report_id uuid,p_organization_id uuid,p_organization_unit_id uuid,p_note text default null
) returns uuid language plpgsql security definer set search_path='public','private' as $$
declare v_transfer_id uuid; v_mairie_id uuid; v_commune_id uuid; v_reference text;
begin
  if (select auth.uid()) is null then raise exception 'Session requise.'; end if;
  select m.id,m.commune_id,r.reference_code into v_mairie_id,v_commune_id,v_reference
  from public.mairies m join public.reports r on r.commune_id=m.commune_id
  where r.id=p_report_id and m.account_user_id=(select auth.uid()) and m.is_active
  for update of r;
  if v_mairie_id is null then raise exception 'La mairie ne peut transmettre que ses signalements communaux'; end if;
  if not exists (
    select 1 from public.organization_units u join public.organizations o on o.id=u.organization_id
    where u.id=p_organization_unit_id and u.organization_id=p_organization_id
      and u.commune_id=v_commune_id and u.is_active and o.is_active and upper(o.code) in ('NIGELEC','NDE')
  ) then raise exception 'La mairie ne peut transmettre qu''à NIGELEC ou NDE de sa propre localité'; end if;
  if exists (select 1 from public.report_organization_transfers where report_id=p_report_id and status='pending')
    then raise exception 'Une transmission est déjà en attente pour ce signalement'; end if;
  insert into public.report_organization_transfers(report_id,organization_id,organization_unit_id,from_mairie_id,transmitted_by,response_note)
  values(p_report_id,p_organization_id,p_organization_unit_id,v_mairie_id,(select auth.uid()),nullif(trim(coalesce(p_note,'')),''))
  returning id into v_transfer_id;
  insert into public.notifications(user_id,report_id,type,title,body)
  select distinct ou.user_id,p_report_id,'organization_transfer','Nouveau signalement transmis',
    'Le signalement '||coalesce(v_reference,p_report_id::text)||' a été transmis à '||o.name||' — '||u.name||'.'
  from public.organization_users ou
  join public.organization_units u on u.id=p_organization_unit_id and u.id=ou.unit_id and u.organization_id=ou.organization_id
  join public.organizations o on o.id=p_organization_id
  where ou.organization_id=p_organization_id and ou.unit_id=p_organization_unit_id and ou.is_active and ou.role in ('admin','supervisor');
  return v_transfer_id;
end; $$;

revoke execute on function public.mairie_transmit_report(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.mairie_transmit_report(uuid,uuid,uuid,text) to authenticated;

create or replace function public.organization_accept_transfer(p_transfer_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path='public','private' as $$
declare v_transfer public.report_organization_transfers%rowtype; v_reference text; v_assignment uuid; v_unit_name text;
begin
  select t.* into v_transfer from public.report_organization_transfers t
  where t.id=p_transfer_id and t.status='pending' for update;
  if v_transfer.id is null then raise exception 'Transmission introuvable ou déjà traitée'; end if;
  if v_transfer.organization_unit_id is null then
    if not exists (
      select 1 from public.organization_users ou join public.organization_units u on u.id=ou.unit_id and u.organization_id=ou.organization_id
      where ou.user_id=(select auth.uid()) and ou.organization_id=v_transfer.organization_id and ou.is_active
        and ou.role in ('admin','supervisor') and u.unit_type='central' and u.is_active
    ) then raise exception 'Accès central organisationnel requis'; end if;
  else
    if not exists (
      select 1 from public.organization_users ou join public.organization_units u on u.id=ou.unit_id and u.organization_id=ou.organization_id
      where ou.user_id=(select auth.uid()) and ou.organization_id=v_transfer.organization_id
        and ou.unit_id=v_transfer.organization_unit_id and ou.is_active
        and ou.role in ('admin','supervisor') and u.unit_type='agency' and u.is_active
    ) then raise exception 'Accès à l''unité locale destinataire requis'; end if;
    if exists (
      select 1 from public.report_unit_assignments rua
      where rua.report_id=v_transfer.report_id and rua.organization_id=v_transfer.organization_id
        and rua.unit_id=v_transfer.organization_unit_id and rua.unassigned_at is null
        and rua.status in ('assigned','accepted','in_progress')
    ) then raise exception 'Une mission active existe déjà pour cette unité locale'; end if;
    insert into public.report_unit_assignments(report_id,organization_id,unit_id,assigned_by,mission_note)
    values(v_transfer.report_id,v_transfer.organization_id,v_transfer.organization_unit_id,(select auth.uid()),nullif(trim(coalesce(p_note,'')),''))
    returning id into v_assignment;
  end if;
  update public.report_organization_transfers
  set status='accepted',responded_by=(select auth.uid()),responded_at=now(),response_note=nullif(trim(coalesce(p_note,'')) ,''),updated_at=now()
  where id=p_transfer_id;
  select reference_code into v_reference from public.reports where id=v_transfer.report_id;
  if v_transfer.organization_unit_id is not null then
    select name into v_unit_name from public.organization_units where id=v_transfer.organization_unit_id;
  end if;
  insert into public.notifications(user_id,report_id,type,title,body)
  select distinct m.account_user_id,v_transfer.report_id,'organization_transfer_response',
    'Transmission acceptée',
    'La transmission du signalement '||coalesce(v_reference,v_transfer.report_id::text)||
    case when v_unit_name is null then ' a été acceptée par l’organisation.' else ' a été acceptée par '||v_unit_name||'.' end
  from public.mairies m where m.id=v_transfer.from_mairie_id and m.is_active and m.account_user_id is not null;
  return coalesce(v_assignment,p_transfer_id);
end; $$;

revoke execute on function public.organization_accept_transfer(uuid,text) from public,anon;
grant execute on function public.organization_accept_transfer(uuid,text) to authenticated;

create or replace function public.organization_decline_transfer(p_transfer_id uuid,p_note text)
returns uuid language plpgsql security definer set search_path='public','private' as $$
declare v_transfer public.report_organization_transfers%rowtype; v_reference text; v_unit_name text;
begin
  if nullif(trim(p_note),'') is null then raise exception 'Un motif de refus est obligatoire'; end if;
  select t.* into v_transfer from public.report_organization_transfers t
  where t.id=p_transfer_id and t.status='pending' for update;
  if v_transfer.id is null then raise exception 'Transmission introuvable ou déjà traitée'; end if;
  if v_transfer.organization_unit_id is null then
    if not exists (
      select 1 from public.organization_users ou join public.organization_units u on u.id=ou.unit_id and u.organization_id=ou.organization_id
      where ou.user_id=(select auth.uid()) and ou.organization_id=v_transfer.organization_id and ou.is_active
        and ou.role in ('admin','supervisor') and u.unit_type='central' and u.is_active
    ) then raise exception 'Accès central organisationnel requis'; end if;
  else
    if not exists (
      select 1 from public.organization_users ou join public.organization_units u on u.id=ou.unit_id and u.organization_id=ou.organization_id
      where ou.user_id=(select auth.uid()) and ou.organization_id=v_transfer.organization_id
        and ou.unit_id=v_transfer.organization_unit_id and ou.is_active
        and ou.role in ('admin','supervisor') and u.unit_type='agency' and u.is_active
    ) then raise exception 'Accès à l''unité locale destinataire requis'; end if;
    select name into v_unit_name from public.organization_units where id=v_transfer.organization_unit_id;
  end if;
  update public.report_organization_transfers
  set status='declined',responded_by=(select auth.uid()),responded_at=now(),response_note=trim(p_note),updated_at=now()
  where id=p_transfer_id;
  select reference_code into v_reference from public.reports where id=v_transfer.report_id;
  insert into public.notifications(user_id,report_id,type,title,body)
  select distinct m.account_user_id,v_transfer.report_id,'organization_transfer_response','Transmission refusée',
    'La transmission du signalement '||coalesce(v_reference,v_transfer.report_id::text)||
    case when v_unit_name is null then ' a été refusée par l’organisation. Motif : ' else ' a été refusée par '||v_unit_name||'. Motif : ' end||trim(p_note)
  from public.mairies m where m.id=v_transfer.from_mairie_id and m.is_active and m.account_user_id is not null;
  return p_transfer_id;
end; $$;

revoke execute on function public.organization_decline_transfer(uuid,text) from public,anon;
grant execute on function public.organization_decline_transfer(uuid,text) to authenticated;
