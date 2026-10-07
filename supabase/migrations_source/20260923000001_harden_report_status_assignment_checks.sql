create or replace function public.validate_report_update()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
begin
  if old.status is distinct from new.status then
    if new.status in ('verification','received','rejected') then
      if not (private.is_staff() or private.is_mairie()) then
        raise exception 'Seul le personnel habilité peut modifier ce statut.';
      end if;
    elsif new.status='in_progress' then
      if not private.is_staff() and not exists (
        select 1 from public.report_assignments ra
        where ra.report_id=new.id and ra.agent_id=auth.uid()
          and ra.unassigned_at is null
          and ra.assignment_status in ('assigned','accepted','in_progress')
      ) then
        raise exception 'Le passage en cours de traitement doit être effectué par l''agent affecté après vérification terrain.';
      end if;
    elsif new.status='resolved' then
      if not exists (
        select 1 from public.report_assignments ra
        where ra.report_id=new.id and ra.agent_id=auth.uid()
          and ra.unassigned_at is null
          and ra.assignment_status in ('assigned','accepted','in_progress')
      ) then
        raise exception 'La résolution doit être publiée par l''agent terrain affecté.';
      end if;
    end if;

    if not (
      (old.status='submitted' and new.status in ('received','verification','rejected'))
      or (old.status='received' and new.status in ('verification','rejected'))
      or (old.status='verification' and new.status in ('in_progress','rejected'))
      or (old.status='in_progress' and new.status in ('resolved','rejected'))
      or (old.status='resolved' and new.status='in_progress')
      or (old.status='rejected' and new.status='received')
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
$function$;
