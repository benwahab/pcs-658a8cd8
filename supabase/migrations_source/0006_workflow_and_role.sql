-- PCS production workflow integrity.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.profiles(id,full_name)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.email))
  on conflict(id) do nothing;

  insert into public.user_roles(user_id,role_id)
  select new.id,id from public.roles where code='citizen'
  on conflict(user_id,role_id) do nothing;

  return new;
end;
$$;

create or replace function public.validate_report_update()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if old.status is distinct from new.status then
    if not (
      (old.status='submitted' and new.status in ('received','rejected')) or
      (old.status='received' and new.status in ('in_progress','rejected')) or
      (old.status='in_progress' and new.status in ('resolved','rejected')) or
      (old.status='resolved' and new.status='in_progress') or
      (old.status='rejected' and new.status='received')
    ) then
      raise exception 'Transition de statut non autorisée: % -> %',old.status,new.status;
    end if;
  end if;

  if new.status='resolved' and old.status is distinct from 'resolved' then
    new.resolved_at=coalesce(new.resolved_at,now());
  elsif new.status<>'resolved' then
    new.resolved_at=null;
  end if;

  new.updated_at=now();
  return new;
end;
$$;

revoke execute on function public.validate_report_update() from public,anon,authenticated;
drop trigger if exists report_workflow_integrity on public.reports;
create trigger report_workflow_integrity
before update on public.reports
for each row execute function public.validate_report_update();
