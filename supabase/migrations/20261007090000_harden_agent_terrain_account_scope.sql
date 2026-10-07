-- PCS: harden field-agent account deactivation and session scope.
-- An inactive field agent must not retain access through an existing session.

create or replace function private.is_active_field_agent()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $function$
  select exists (
    select 1
    from public.field_agents fa
    where fa.user_id = auth.uid()
      and fa.is_active
  );
$function$;

revoke all on function private.is_active_field_agent() from public, anon;
grant execute on function private.is_active_field_agent() to authenticated;

create or replace function private.user_has_active_report_assignment(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.report_assignments ra
    join public.field_agents fa on fa.user_id = ra.agent_id and fa.is_active
    where ra.report_id = p_report_id
      and ra.agent_id = (select auth.uid())
      and ra.unassigned_at is null
  );
$function$;

revoke all on function private.user_has_active_report_assignment(uuid) from public, anon;
grant execute on function private.user_has_active_report_assignment(uuid) to authenticated;

drop policy if exists reports_select_scoped on public.reports;
create policy reports_select_scoped
on public.reports
for select
using (
  citizen_id = auth.uid()
  or private.is_staff()
  or exists (
    select 1
    from public.mairies m
    where m.account_user_id = auth.uid()
      and m.commune_id = reports.commune_id
      and m.is_active
  )
  or exists (
    select 1
    from public.report_assignments ra
    join public.field_agents fa on fa.user_id = ra.agent_id and fa.is_active
    where ra.report_id = reports.id
      and ra.agent_id = auth.uid()
      and ra.unassigned_at is null
  )
);

drop policy if exists assignments_select_scoped on public.report_assignments;
drop policy if exists assignments_mairie_or_agent on public.report_assignments;
create policy assignments_select_scoped
on public.report_assignments
for select
using (
  (agent_id = auth.uid() and private.is_active_field_agent())
  or assigned_by = auth.uid()
  or private.is_staff()
  or exists (
    select 1
    from public.reports r
    join public.mairies m on m.commune_id = r.commune_id
    where r.id = report_assignments.report_id
      and m.account_user_id = auth.uid()
      and m.is_active
  )
);

drop policy if exists verification_select_scoped on public.report_field_verifications;
create policy verification_select_scoped
on public.report_field_verifications
for select
using (
  (agent_id = auth.uid() and private.is_active_field_agent())
  or private.is_staff()
  or exists (
    select 1
    from public.reports r
    where r.id = report_field_verifications.report_id
      and r.citizen_id = auth.uid()
  )
  or exists (
    select 1
    from public.reports r
    join public.mairies m on m.commune_id = r.commune_id
    where r.id = report_field_verifications.report_id
      and m.account_user_id = auth.uid()
      and m.is_active
  )
);

drop policy if exists verification_insert on public.report_field_verifications;
create policy verification_insert
on public.report_field_verifications
for insert to authenticated
with check (
  agent_id = auth.uid()
  and private.is_active_field_agent()
  and exists (
    select 1
    from public.report_assignments ra
    where ra.id = report_field_verifications.assignment_id
      and ra.report_id = report_field_verifications.report_id
      and ra.agent_id = auth.uid()
      and ra.unassigned_at is null
  )
);

drop policy if exists media_select_scoped on public.report_media;
create policy media_select_scoped
on public.report_media
for select
using (
  exists (
    select 1
    from public.reports r
    where r.id = report_media.report_id
      and (
        r.citizen_id = auth.uid()
        or private.is_staff()
        or exists (
          select 1
          from public.mairies m
          where m.account_user_id = auth.uid()
            and m.commune_id = r.commune_id
            and m.is_active
        )
        or exists (
          select 1
          from public.report_assignments ra
          join public.field_agents fa on fa.user_id = ra.agent_id and fa.is_active
          where ra.report_id = r.id
            and ra.agent_id = auth.uid()
            and ra.unassigned_at is null
        )
      )
  )
);

drop policy if exists media_insert_agent_resolution on public.report_media;
drop policy if exists media_insert on public.report_media;
create policy media_insert
on public.report_media
for insert to authenticated
with check (
  media_role = 'resolution_video'
  and moderation_status = 'pending'
  and media_type in ('video/mp4','video/webm','video/quicktime')
  and file_size is not null
  and file_size between 1 and 104857600
  and captured_latitude is not null
  and captured_longitude is not null
  and accuracy_m is not null
  and accuracy_m between 0 and 20
  and uploaded_by = auth.uid()
  and private.is_active_field_agent()
  and exists (
    select 1
    from public.report_assignments ra
    join public.reports r on r.id = ra.report_id
    where ra.report_id = report_media.report_id
      and ra.agent_id = auth.uid()
      and ra.unassigned_at is null
      and ra.assignment_status in ('assigned','accepted','in_progress')
      and r.status = 'in_progress'
      and r.latitude is not null
      and r.longitude is not null
      and earth_distance(
        ll_to_earth(r.latitude,r.longitude),
        ll_to_earth(report_media.captured_latitude,report_media.captured_longitude)
      ) <= 20
  )
);

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
  if not exists (
    select 1 from public.field_agents
    where user_id = auth.uid() and is_active
  ) then
    raise exception 'Compte agent terrain inactif ou non autorisé.';
  end if;
  if p_latitude is null or p_longitude is null then raise exception 'La localisation GPS est obligatoire.'; end if;
  if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then raise exception 'Coordonnées GPS invalides.'; end if;
  if p_accuracy_m is null or p_accuracy_m > 20 then raise exception 'La précision GPS doit être de 20 mètres ou moins.'; end if;

  select * into a
  from public.report_assignments
  where report_id = p_report_id
    and agent_id = auth.uid()
    and unassigned_at is null
    and assignment_status in ('assigned','accepted','in_progress')
  order by assigned_at desc
  limit 1;

  if a.id is null then raise exception 'Aucune mission active pour cet agent.'; end if;

  select * into r from public.reports where id = p_report_id for update;
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
  if not exists (
    select 1 from public.field_agents
    where user_id = auth.uid() and is_active
  ) then
    raise exception 'Compte agent terrain inactif ou non autorisé.';
  end if;

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

revoke execute on function public.agent_confirm_field_verification(uuid,double precision,double precision,double precision) from public, anon;
grant execute on function public.agent_confirm_field_verification(uuid,double precision,double precision,double precision) to authenticated;

revoke execute on function public.agent_resolve_report(uuid,uuid,text) from public, anon;
grant execute on function public.agent_resolve_report(uuid,uuid,text) to authenticated;

-- Existing field-agent accounts created before this hardening inherited the citizen role
-- from the generic auth-user trigger. Keep terrain accounts operational-only.
delete from public.user_roles ur
using public.roles r, public.field_agents fa
where ur.role_id = r.id
  and ur.user_id = fa.user_id
  and r.code = 'citizen';
