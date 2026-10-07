create or replace function public.validate_resolution_note() returns trigger language plpgsql security definer set search_path=public,private as $$
begin
 if new.status='resolved' and (new.resolution_note is null or char_length(trim(new.resolution_note))<5) then
  raise exception 'Une note de résolution est obligatoire pour clôturer un signalement';
 end if;
 if new.status<>'resolved' then new.resolution_note:=null; end if;
 return new;
end; $$;
revoke execute on function public.validate_resolution_note() from public,anon,authenticated;
create trigger report_resolution_validation before update of status,resolution_note on public.reports for each row execute function public.validate_resolution_note();
