create or replace function public.notify_report_status_change() returns trigger language plpgsql security definer set search_path=public,private as $$
declare status_label text;
begin
 if new.status is distinct from old.status then
  status_label:=case new.status when 'received' then 'Reçu' when 'in_progress' then 'En cours' when 'resolved' then 'Résolu' when 'rejected' then 'Rejeté' else 'Envoyé' end;
  insert into public.notifications(user_id,report_id,type,title,body) values(new.citizen_id,new.id,'status_change','Mise à jour de votre signalement','Le signalement '||new.reference_code||' est maintenant : '||status_label||'.');
 end if;
 return new;
end; $$;
revoke execute on function public.notify_report_status_change() from public,anon,authenticated;
create trigger report_status_notification_trigger after update of status on public.reports for each row execute function public.notify_report_status_change();

create or replace function public.notify_assignment_change() returns trigger language plpgsql security definer set search_path=public,private as $$
begin
 if new.agent_id is not null then
  insert into public.notifications(user_id,report_id,type,title,body) values(new.agent_id,new.report_id,'assignment','Nouveau signalement attribué','Un signalement vous a été attribué pour traitement.');
 end if;
 return new;
end; $$;
revoke execute on function public.notify_assignment_change() from public,anon,authenticated;
create trigger report_assignment_notification_trigger after insert on public.report_assignments for each row execute function public.notify_assignment_change();
