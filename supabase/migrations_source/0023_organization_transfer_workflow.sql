-- PCS 0023: workflow sécurisé mairie -> organisation centrale -> agence
-- Aucun central ne peut affecter directement un agent terrain.

create or replace function public.mairie_transmit_report(p_report_id uuid,p_organization_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path=public,private as $$
declare v_transfer_id uuid; v_mairie_id uuid;
begin
 select m.id into v_mairie_id from public.mairies m join public.reports r on r.commune_id=m.commune_id
 where r.id=p_report_id and m.account_user_id=auth.uid() and m.is_active;
 if v_mairie_id is null then raise exception 'La mairie ne peut transmettre que ses signalements communaux'; end if;
 if not exists(select 1 from public.organizations where id=p_organization_id and is_active) then raise exception 'Organisation destinataire invalide ou inactive'; end if;
 if exists(select 1 from public.report_organization_transfers where report_id=p_report_id and status='pending') then raise exception 'Une transmission est déjà en attente pour ce signalement'; end if;
 insert into public.report_organization_transfers(report_id,organization_id,from_mairie_id,transmitted_by,response_note)
 values(p_report_id,p_organization_id,v_mairie_id,auth.uid(),p_note) returning id into v_transfer_id;
 return v_transfer_id;
end $$;

create or replace function public.organization_accept_transfer(p_transfer_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path=public,private as $$
declare v_transfer public.report_organization_transfers%rowtype;
begin
 select * into v_transfer from public.report_organization_transfers where id=p_transfer_id and status='pending' for update;
 if v_transfer.id is null then raise exception 'Transmission introuvable ou déjà traitée'; end if;
 if not exists(select 1 from public.organization_users ou where ou.user_id=auth.uid() and ou.organization_id=v_transfer.organization_id and ou.is_active and ou.unit_id is null and ou.role in('admin','supervisor')) then raise exception 'Accès central organisationnel requis'; end if;
 update public.report_organization_transfers set status='accepted',responded_by=auth.uid(),responded_at=now(),response_note=p_note,updated_at=now() where id=p_transfer_id;
 return p_transfer_id;
end $$;

create or replace function public.organization_decline_transfer(p_transfer_id uuid,p_note text)
returns uuid language plpgsql security definer set search_path=public,private as $$
declare v_transfer public.report_organization_transfers%rowtype;
begin
 if nullif(trim(p_note),'') is null then raise exception 'Un motif de refus est obligatoire'; end if;
 select * into v_transfer from public.report_organization_transfers where id=p_transfer_id and status='pending' for update;
 if v_transfer.id is null then raise exception 'Transmission introuvable ou déjà traitée'; end if;
 if not exists(select 1 from public.organization_users ou where ou.user_id=auth.uid() and ou.organization_id=v_transfer.organization_id and ou.is_active and ou.unit_id is null and ou.role in('admin','supervisor')) then raise exception 'Accès central organisationnel requis'; end if;
 update public.report_organization_transfers set status='declined',responded_by=auth.uid(),responded_at=now(),response_note=p_note,updated_at=now() where id=p_transfer_id;
 return p_transfer_id;
end $$;

create or replace function public.organization_assign_agency(p_transfer_id uuid,p_agency_unit_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path=public,private as $$
declare v_transfer public.report_organization_transfers%rowtype; v_assignment uuid;
begin
 select * into v_transfer from public.report_organization_transfers where id=p_transfer_id and status='accepted' for update;
 if v_transfer.id is null then raise exception 'La transmission doit être acceptée avant attribution'; end if;
 if not exists(select 1 from public.organization_users ou where ou.user_id=auth.uid() and ou.organization_id=v_transfer.organization_id and ou.unit_id is null and ou.is_active and ou.role in('admin','supervisor')) then raise exception 'Seul le central de l''organisation peut attribuer une agence'; end if;
 if not exists(select 1 from public.organization_units u join public.organization_units central on central.id=u.parent_unit_id and central.organization_id=u.organization_id and central.unit_type='central' and central.organization_id=v_transfer.organization_id where u.id=p_agency_unit_id and u.unit_type='agency' and u.is_active) then raise exception 'L''unité sélectionnée n''est pas une agence de cette organisation'; end if;
 if exists(select 1 from public.report_unit_assignments where report_id=v_transfer.report_id and unassigned_at is null) then raise exception 'Une mission active existe déjà pour ce signalement'; end if;
 insert into public.report_unit_assignments(report_id,organization_id,unit_id,assigned_by,mission_note)
 values(v_transfer.report_id,v_transfer.organization_id,p_agency_unit_id,auth.uid(),p_note) returning id into v_assignment;
 update public.report_organization_transfers set status='completed',updated_at=now() where id=p_transfer_id;
 return v_assignment;
end $$;

drop policy if exists report_org_transfers_org_read on public.report_organization_transfers;
create policy report_org_transfers_org_read on public.report_organization_transfers for select to authenticated using(
 private.is_staff() or exists(select 1 from public.organization_users ou where ou.user_id=auth.uid() and ou.organization_id=report_organization_transfers.organization_id and ou.is_active)
 or exists(select 1 from public.mairies m where m.id=report_organization_transfers.from_mairie_id and m.account_user_id=auth.uid() and m.is_active));

drop policy if exists report_unit_assignments_unit_read on public.report_unit_assignments;
create policy report_unit_assignments_unit_read on public.report_unit_assignments for select to authenticated using(
 private.is_staff() or exists(select 1 from public.organization_users ou where ou.user_id=auth.uid() and ou.organization_id=report_unit_assignments.organization_id and ou.is_active and (ou.unit_id is null or ou.unit_id=report_unit_assignments.unit_id)));

revoke execute on function public.mairie_transmit_report(uuid,uuid,text) from public,anon;
grant execute on function public.mairie_transmit_report(uuid,uuid,text) to authenticated;
revoke execute on function public.organization_accept_transfer(uuid,text) from public,anon;
grant execute on function public.organization_accept_transfer(uuid,text) to authenticated;
revoke execute on function public.organization_decline_transfer(uuid,text) from public,anon;
grant execute on function public.organization_decline_transfer(uuid,text) to authenticated;
revoke execute on function public.organization_assign_agency(uuid,uuid,text) from public,anon;
grant execute on function public.organization_assign_agency(uuid,uuid,text) to authenticated;