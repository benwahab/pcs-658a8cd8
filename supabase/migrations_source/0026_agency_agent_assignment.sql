-- PCS 0026: agence -> agent terrain
create or replace function public.agency_can_manage_agent(p_agent_id uuid)
returns boolean language sql stable security definer set search_path=public,private as $$
 select exists(select 1 from public.field_agents fa join public.organization_users ou on ou.organization_id=fa.organization_id and ou.unit_id=fa.organization_unit_id where fa.id=p_agent_id and fa.mairie_id is null and fa.is_active and ou.user_id=auth.uid() and ou.is_active and ou.role in ('admin','supervisor'));
$$;
create or replace function public.agency_assign_report_to_agent(p_unit_assignment_id uuid,p_agent_id uuid,p_mission_note text default null)
returns uuid language plpgsql security definer set search_path=public,private as $$
declare v_report_id uuid; v_unit_id uuid; v_org_id uuid; v_assignment_id uuid;
begin
 select rua.report_id,rua.unit_id,rua.organization_id into v_report_id,v_unit_id,v_org_id from public.report_unit_assignments rua where rua.id=p_unit_assignment_id and rua.unassigned_at is null and rua.status in ('assigned','accepted') for update;
 if v_report_id is null then raise exception 'Mission agence introuvable ou inactive'; end if;
 if not exists(select 1 from public.organization_users ou where ou.user_id=auth.uid() and ou.organization_id=v_org_id and ou.unit_id=v_unit_id and ou.is_active and ou.role in ('admin','supervisor')) then raise exception 'Accès agence requis'; end if;
 if not exists(select 1 from public.field_agents fa where fa.id=p_agent_id and fa.organization_id=v_org_id and fa.organization_unit_id=v_unit_id and fa.mairie_id is null and fa.is_active) then raise exception 'Cet agent n''appartient pas à cette agence'; end if;
 if exists(select 1 from public.report_assignments ra where ra.report_id=v_report_id and ra.unassigned_at is null) then raise exception 'Un agent est déjà affecté à ce signalement'; end if;
 insert into public.report_assignments(report_id,agent_id,assigned_by,assigned_at,assignment_status,mission_note,unit_assignment_id)
 values(v_report_id,(select user_id from public.field_agents where id=p_agent_id),auth.uid(),now(),'assigned',coalesce(p_mission_note,(select mission_note from public.report_unit_assignments where id=p_unit_assignment_id)),p_unit_assignment_id)
 returning id into v_assignment_id;
 update public.report_unit_assignments set status='accepted',updated_at=now() where id=p_unit_assignment_id;
 return v_assignment_id;
end;
$$;
drop policy if exists field_agents_agency_manage on public.field_agents;
create policy field_agents_agency_manage on public.field_agents for all to authenticated
using(private.is_staff() or user_id=auth.uid() or (mairie_id is not null and mairie_id=private.my_mairie_id()) or public.agency_can_manage_agent(id))
with check(private.is_staff() or (mairie_id is not null and mairie_id=private.my_mairie_id()) or (mairie_id is null and public.agency_can_manage_agent(id)));
revoke execute on function public.agency_assign_report_to_agent(uuid,uuid,text) from public,anon;
grant execute on function public.agency_assign_report_to_agent(uuid,uuid,text) to authenticated;