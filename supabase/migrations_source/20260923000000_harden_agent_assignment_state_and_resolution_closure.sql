create or replace function public.agent_confirm_field_verification(
  p_report_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision
)
returns public.report_field_verifications
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  a public.report_assignments;
  r public.reports;
  v public.report_field_verifications;
begin
  if auth.uid() is null then raise exception 'Session requise.'; end if;
  if p_latitude is null or p_longitude is null then raise exception 'La localisation GPS est obligatoire.'; end if;
  if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then raise exception 'Coordonnées GPS invalides.'; end if;
  if p_accuracy_m is null or p_accuracy_m > 20 then raise exception 'La précision GPS doit être de 20 mètres ou moins.'; end if;

  select * into a
  from public.report_assignments
  where report_id=p_report_id
    and agent_id=auth.uid()
    and unassigned_at is null
    and assignment_status in ('assigned','accepted','in_progress')
  order by assigned_at desc
  limit 1;

  if a.id is null then raise exception 'Aucune mission active pour cet agent.'; end if;

  select * into r from public.reports where id=p_report_id for update;
  if r.status <> 'verification' then raise exception 'Le signalement n''est pas en phase de vérification.'; end if;
  if r.latitude is null or r.longitude is null then raise exception 'Le signalement ne possède pas de coordonnées GPS.'; end if;
  if earth_distance(ll_to_earth(r.latitude,r.longitude),ll_to_earth(p_latitude,p_longitude)) > 20 then
    raise exception 'Vous devez être à 20 mètres ou moins du lieu du signalement.';
  end if;

  insert into public.report_field_verifications(report_id,assignment_id,agent_id,latitude,longitude,accuracy_m)
  values(p_report_id,a.id,auth.uid(),p_latitude,p_longitude,p_accuracy_m)
  on conflict (assignment_id) do update
    set latitude=excluded.latitude,
        longitude=excluded.longitude,
        accuracy_m=excluded.accuracy_m,
        verified_at=now()
  returning * into v;

  update public.report_assignments
  set assignment_status='in_progress', started_at=coalesce(started_at,now())
  where id=a.id;

  update public.reports set status='in_progress' where id=p_report_id;
  return v;
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
    and media_type like 'video/%';

  if rm.id is null then raise exception 'La vidéo de résolution est introuvable ou non autorisée.'; end if;
  if rm.captured_latitude is null or rm.captured_longitude is null then raise exception 'La vidéo doit être géolocalisée.'; end if;
  if r.latitude is null or r.longitude is null then raise exception 'Le signalement ne possède pas de coordonnées GPS.'; end if;
  if earth_distance(ll_to_earth(r.latitude,r.longitude),ll_to_earth(rm.captured_latitude,rm.captured_longitude)) > 20 then
    raise exception 'La vidéo doit être publiée à 20 mètres ou moins du lieu du signalement.';
  end if;

  note := nullif(trim(coalesce(p_resolution_note,'')),'');
  if note is null then note := 'Résolution constatée et publiée par l''agent terrain sur le lieu du signalement.'; end if;

  update public.reports
  set status='resolved', resolution_note=note
  where id=p_report_id;

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

create or replace function public.agency_assign_report_to_agent(
  p_unit_assignment_id uuid,
  p_agent_id uuid,
  p_mission_note text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  v_report_id uuid;
  v_unit_id uuid;
  v_org_id uuid;
  v_assignment_id uuid;
begin
  select rua.report_id, rua.unit_id, rua.organization_id
    into v_report_id,v_unit_id,v_org_id
  from public.report_unit_assignments rua
  where rua.id=p_unit_assignment_id
    and rua.unassigned_at is null
    and rua.status in ('assigned','accepted')
  for update;

  if v_report_id is null then raise exception 'Mission agence introuvable ou inactive'; end if;

  if not exists(
    select 1 from public.organization_users ou
    where ou.user_id=auth.uid()
      and ou.organization_id=v_org_id
      and ou.unit_id=v_unit_id
      and ou.is_active
      and ou.role in ('admin','supervisor')
  ) then raise exception 'Accès agence requis'; end if;

  if not exists(
    select 1 from public.field_agents fa
    where fa.id=p_agent_id
      and fa.organization_id=v_org_id
      and fa.organization_unit_id=v_unit_id
      and fa.mairie_id is null
      and fa.is_active
  ) then raise exception 'Cet agent n''appartient pas à cette agence'; end if;

  if exists(
    select 1 from public.report_assignments ra
    where ra.report_id=v_report_id
      and ra.unassigned_at is null
      and ra.assignment_status in ('assigned','accepted','in_progress')
  ) then raise exception 'Un agent est déjà affecté à ce signalement'; end if;

  insert into public.report_assignments(
    report_id,agent_id,assigned_by,assigned_at,assignment_status,mission_note,unit_assignment_id
  )
  values(
    v_report_id,
    (select user_id from public.field_agents where id=p_agent_id),
    auth.uid(),now(),'assigned',
    coalesce(p_mission_note,(select mission_note from public.report_unit_assignments where id=p_unit_assignment_id)),
    p_unit_assignment_id
  )
  returning id into v_assignment_id;

  update public.report_unit_assignments
  set status='accepted',updated_at=now()
  where id=p_unit_assignment_id;

  return v_assignment_id;
end;
$function$;
