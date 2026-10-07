-- Harden field-agent workflow:
-- one active assignment per report;
-- only the assigned agent can upload a resolution video while the report is in progress;
-- resolution requires the agent's own geolocated video within 20m.

create unique index if not exists report_assignments_one_active_per_report_uidx
  on public.report_assignments(report_id)
  where unassigned_at is null;

drop policy if exists media_insert_agent_resolution on public.report_media;

create policy media_insert_agent_resolution
on public.report_media
for insert
with check (
  media_role = 'resolution_video'
  and uploaded_by = auth.uid()
  and media_type like 'video/%'
  and exists (
    select 1
    from public.report_assignments ra
    join public.reports r on r.id = ra.report_id
    where ra.report_id = report_media.report_id
      and ra.agent_id = auth.uid()
      and ra.unassigned_at is null
      and r.status = 'in_progress'
  )
);

create or replace function private.validate_resolution_video()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  ok boolean;
begin
  if new.status = 'resolved' and old.status is distinct from new.status then
    select exists(
      select 1
      from public.report_media rm
      join public.report_assignments ra
        on ra.report_id = rm.report_id
       and ra.agent_id = rm.uploaded_by
       and ra.unassigned_at is null
      where rm.report_id = new.id
        and rm.media_role = 'resolution_video'
        and rm.media_type like 'video/%'
        and rm.uploaded_by = auth.uid()
        and rm.captured_latitude is not null
        and rm.captured_longitude is not null
        and new.latitude is not null
        and new.longitude is not null
        and earth_distance(
          ll_to_earth(new.latitude,new.longitude),
          ll_to_earth(rm.captured_latitude,rm.captured_longitude)
        ) <= 20
    ) into ok;

    if not ok then
      raise exception 'Une vidéo de résolution géolocalisée à 20 mètres ou moins du lieu du signalement est obligatoire.';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.agent_resolve_report(
  p_report_id uuid,
  p_media_id uuid,
  p_resolution_note text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  r public.reports;
  rm public.report_media;
  has_assignment boolean;
  note text;
begin
  if auth.uid() is null then
    raise exception 'Session requise.';
  end if;

  select * into r
  from public.reports
  where id = p_report_id
  for update;

  if r.id is null then
    raise exception 'Signalement introuvable.';
  end if;

  if r.status <> 'in_progress' then
    raise exception 'Le signalement doit être en cours de traitement.';
  end if;

  select exists(
    select 1
    from public.report_assignments
    where report_id = p_report_id
      and agent_id = auth.uid()
      and unassigned_at is null
  ) into has_assignment;

  if not has_assignment then
    raise exception 'Vous n''êtes pas affecté à ce signalement.';
  end if;

  select * into rm
  from public.report_media
  where id = p_media_id
    and report_id = p_report_id
    and media_role = 'resolution_video'
    and uploaded_by = auth.uid()
    and media_type like 'video/%';

  if rm.id is null then
    raise exception 'La vidéo de résolution est introuvable ou non autorisée.';
  end if;

  if rm.captured_latitude is null or rm.captured_longitude is null then
    raise exception 'La vidéo doit être géolocalisée.';
  end if;

  if r.latitude is null or r.longitude is null then
    raise exception 'Le signalement ne possède pas de coordonnées GPS.';
  end if;

  if earth_distance(
    ll_to_earth(r.latitude,r.longitude),
    ll_to_earth(rm.captured_latitude,rm.captured_longitude)
  ) > 20 then
    raise exception 'La vidéo doit être publiée à 20 mètres ou moins du lieu du signalement.';
  end if;

  note := nullif(trim(coalesce(p_resolution_note,'')),'');
  if note is null then
    note := 'Résolution constatée et publiée par l''agent terrain sur le lieu du signalement.';
  end if;

  update public.reports
  set status = 'resolved',
      resolution_note = note
  where id = p_report_id;

  update public.report_assignments
  set assignment_status = 'completed',
      completed_at = now()
  where report_id = p_report_id
    and agent_id = auth.uid()
    and unassigned_at is null;

  return (
    select rr
    from public.reports rr
    where rr.id = p_report_id
  );
end;
$function$;
