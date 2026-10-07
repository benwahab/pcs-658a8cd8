-- PCS status history and citizen notification trigger
create or replace function public.record_report_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.report_status_history(report_id,actor_id,old_status,new_status)
    values(new.id,auth.uid(),old.status,new.status);

    insert into public.notifications(user_id,report_id,type,title,body)
    values(
      new.citizen_id,
      new.id,
      'status_changed',
      'Mise à jour de votre signalement',
      'Le statut de votre signalement ' || new.reference_code || ' est maintenant : ' || new.status
    );
  end if;
  return new;
end;
$$;

drop trigger if exists report_status_history_trigger on public.reports;
create trigger report_status_history_trigger
after update of status on public.reports
for each row execute function public.record_report_status_change();