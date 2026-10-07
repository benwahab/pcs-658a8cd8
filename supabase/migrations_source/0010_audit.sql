create or replace function public.audit_report_update() returns trigger language plpgsql security definer set search_path=public,private as $$
declare actor uuid;
begin
 actor:=auth.uid();
 if new.status is distinct from old.status or new.priority is distinct from old.priority or new.department_id is distinct from old.department_id or new.resolution_note is distinct from old.resolution_note then
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(actor,'update','report',new.id,jsonb_build_object('old_status',old.status,'new_status',new.status,'old_priority',old.priority,'new_priority',new.priority,'old_department_id',old.department_id,'new_department_id',new.department_id,'resolution_note_changed',new.resolution_note is distinct from old.resolution_note));
 end if;
 return new;
end; $$;
revoke execute on function public.audit_report_update() from public,anon,authenticated;
create trigger report_audit_update_trigger after update on public.reports for each row execute function public.audit_report_update();

create or replace function public.audit_assignment_change() returns trigger language plpgsql security definer set search_path=public,private as $$
begin
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),case when tg_op='INSERT' then 'assign' else 'unassign' end,'report_assignment',coalesce(new.id,old.id),jsonb_build_object('report_id',coalesce(new.report_id,old.report_id),'department_id',coalesce(new.department_id,old.department_id),'agent_id',coalesce(new.agent_id,old.agent_id)));
 return coalesce(new,old);
end; $$;
revoke execute on function public.audit_assignment_change() from public,anon,authenticated;
create trigger assignment_audit_insert after insert on public.report_assignments for each row execute function public.audit_assignment_change();
create trigger assignment_audit_update after update on public.report_assignments for each row execute function public.audit_assignment_change();
