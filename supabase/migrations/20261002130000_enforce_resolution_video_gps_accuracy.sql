-- Store the GPS accuracy reported at capture time and enforce it server-side.
alter table public.report_media
  add column if not exists accuracy_m double precision;

alter table public.report_media
  drop constraint if exists report_media_resolution_accuracy_check;

alter table public.report_media
  add constraint report_media_resolution_accuracy_check
  check (
    media_role <> 'resolution_video'
    or (accuracy_m is not null and accuracy_m >= 0 and accuracy_m <= 20)
  ) not valid;

create or replace function public.agent_resolve_report(
  p_report_id uuid,
  p_media_id uuid,
  p_resolution_note text default null
)
returns public.reports
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  r public.reports;
  rm public.report_media;
  a public.report_assignments;
  note text;
begin
  if auth.uid() is null then raise exception 'Session requise.'; end if;

  select * into r from public.reports where id=p_report_id for update;
  if r.id is null then raise exception 'Signalement introuvable.'; end if;
  if r.status <> 'in_progress' then raise exception 'Le signalement doit être en cours de traitement.'; end if;

  select * into a
  from public.report_assignments
  where report_id=p_report_id
    and agent_id=auth.uid()
    and unassigned_at is null
    and assignment_status in ('assigned','accepted','in_progress')
  order by assigned_at desc
  limit 1;

  if a.id is null then raise exception 'Vous n''êtes pas affecté à ce signalement.'; end if;

  select * into rm
  from public.report_media
  where id=p_media_id
    and report_id=p_report_id
    and media_role='resolution_video'
    and uploaded_by=auth.uid()
    and media_type in ('video/mp4','video/webm','video/quicktime');

  if rm.id is null then raise exception 'La vidéo de résolution est introuvable ou non autorisée.'; end if;
  if rm.captured_latitude is null or rm.captured_longitude is null then raise exception 'La vidéo doit être géolocalisée.'; end if;
  if rm.accuracy_m is null or rm.accuracy_m < 0 or rm.accuracy_m > 20 then
    raise exception 'La précision GPS de la vidéo doit être de 20 mètres ou moins.';
  end if;
  if r.latitude is null or r.longitude is null then raise exception 'Le signalement ne possède pas de coordonnées GPS.'; end if;
  if earth_distance(ll_to_earth(r.latitude,r.longitude),ll_to_earth(rm.captured_latitude,rm.captured_longitude)) > 20 then
    raise exception 'La vidéo doit être publiée à 20 mètres ou moins du lieu du signalement.';
  end if;

  note := nullif(trim(coalesce(p_resolution_note,'')),'');
  if note is null then note := 'Résolution constatée et publiée par l''agent terrain sur le lieu du signalement.'; end if;

  update public.reports set status='resolved', resolution_note=note where id=p_report_id;

  update public.report_assignments
  set assignment_status='completed', completed_at=now()
  where id=a.id;

  update public.report_unit_assignments rua
  set status='completed', completed_at=coalesce(completed_at,now()), updated_at=now()
  where rua.id=a.unit_assignment_id
    and rua.status in ('assigned','accepted','in_progress');

  return (select rr from public.reports rr where rr.id=p_report_id);
end;
$function$;
