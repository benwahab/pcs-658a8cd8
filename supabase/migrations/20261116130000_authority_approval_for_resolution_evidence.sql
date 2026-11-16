-- PCS: require approval by the original receiving authority before closing a field resolution.
-- Resolution evidence stays attached to its source report and may be either a photo or a video.

-- Remove the old 100 MB application/storage cap; accepted MIME types remain explicitly allowlisted.
alter table public.report_media drop constraint if exists report_media_file_size_check;
update storage.buckets
set file_size_limit = null,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime'
    ]
where id = 'report-media';

-- Agents may upload a photo or video only for a report assigned to them and only at the verified location.
drop policy if exists media_insert on public.report_media;
create policy media_insert
on public.report_media for insert to authenticated
with check (
  media_role = 'resolution_video'
  and moderation_status = 'pending'
  and (
    media_type in ('video/mp4', 'video/webm', 'video/quicktime')
    or media_type in ('image/jpeg', 'image/png', 'image/webp')
  )
  and file_size is not null
  and file_size >= 1
  and captured_latitude is not null
  and captured_longitude is not null
  and accuracy_m between 0 and 20
  and uploaded_by = (select auth.uid())
  and private.is_active_field_agent()
  and exists (
    select 1
    from public.report_assignments ra
    join public.reports r on r.id = ra.report_id
    where ra.report_id = report_media.report_id
      and ra.agent_id = (select auth.uid())
      and ra.unassigned_at is null
      and ra.assignment_status in ('assigned', 'accepted', 'in_progress')
      and r.status = 'in_progress'
      and r.latitude is not null
      and r.longitude is not null
      and earth_distance(
        ll_to_earth(r.latitude, r.longitude),
        ll_to_earth(report_media.captured_latitude, report_media.captured_longitude)
      ) <= 20
  )
);

drop policy if exists report_media_storage_insert on storage.objects;
create policy report_media_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'report-media'
  and lower(storage.extension(name)) in ('mp4', 'webm', 'mov', 'm4v', 'jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1
    from public.report_assignments ra
    join public.reports r on r.id = ra.report_id
    where ra.report_id = (split_part(objects.name, '/', 1))::uuid
      and ra.agent_id = (select auth.uid())
      and ra.unassigned_at is null
      and ra.assignment_status in ('assigned', 'accepted', 'in_progress')
      and r.status = 'in_progress'
  )
);

-- A mairie can review only reports that were not transferred to NIGELEC/NDE.
create or replace function private.can_read_mairie_resolution_media_storage(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.report_media rm
    join public.reports r on r.id = rm.report_id
    join public.mairies m on m.commune_id = r.commune_id
    where rm.storage_path = p_storage_path
      and rm.media_role = 'resolution_video'
      and m.account_user_id = (select auth.uid())
      and m.is_active = true
      and not exists (
        select 1
        from public.report_organization_transfers t
        where t.report_id = r.id
          and t.status in ('pending', 'accepted', 'completed')
      )
  );
$function$;

drop policy if exists media_select_mairie_resolution_review on public.report_media;
create policy media_select_mairie_resolution_review
on public.report_media for select to authenticated
using (
  media_role = 'resolution_video'
  and exists (
    select 1
    from public.reports r
    join public.mairies m on m.commune_id = r.commune_id
    where r.id = report_media.report_id
      and m.account_user_id = (select auth.uid())
      and m.is_active = true
      and not exists (
        select 1
        from public.report_organization_transfers t
        where t.report_id = r.id
          and t.status in ('pending', 'accepted', 'completed')
      )
  )
);

-- Central NIGELEC/NDE managers can read pending evidence for reports transferred to their organization.
drop policy if exists media_select_central_resolution_review on public.report_media;
create policy media_select_central_resolution_review
on public.report_media for select to authenticated
using (
  media_role = 'resolution_video'
  and moderation_status = 'pending'
  and exists (
    select 1
    from public.report_organization_transfers t
    join public.organizations o on o.id = t.organization_id
    join public.organization_users ou on ou.organization_id = o.id
    where t.report_id = report_media.report_id
      and t.status in ('accepted', 'completed')
      and upper(o.code) in ('NIGELEC', 'NDE')
      and ou.user_id = (select auth.uid())
      and ou.is_active
      and ou.role in ('admin', 'supervisor')
      and (
        (ou.unit_id is null and exists (
          select 1 from public.organization_units cu
          where cu.organization_id = ou.organization_id
            and cu.unit_type = 'central' and cu.is_active
        ))
        or exists (
          select 1 from public.organization_units cu
          where cu.id = ou.unit_id
            and cu.organization_id = ou.organization_id
            and cu.unit_type = 'central' and cu.is_active
        )
      )
  )
);

drop policy if exists report_media_storage_central_resolution_read on storage.objects;
create policy report_media_storage_central_resolution_read
on storage.objects for select to authenticated
using (
  bucket_id = 'report-media'
  and exists (
    select 1
    from public.report_media rm
    join public.report_organization_transfers t on t.report_id = rm.report_id
    join public.organizations o on o.id = t.organization_id
    join public.organization_users ou on ou.organization_id = o.id
    where rm.storage_path = objects.name
      and rm.media_role = 'resolution_video'
      and rm.moderation_status = 'pending'
      and t.status in ('accepted', 'completed')
      and upper(o.code) in ('NIGELEC', 'NDE')
      and ou.user_id = (select auth.uid())
      and ou.is_active
      and ou.role in ('admin', 'supervisor')
      and (
        (ou.unit_id is null and exists (
          select 1 from public.organization_units cu
          where cu.organization_id = ou.organization_id
            and cu.unit_type = 'central' and cu.is_active
        ))
        or exists (
          select 1 from public.organization_units cu
          where cu.id = ou.unit_id
            and cu.organization_id = ou.organization_id
            and cu.unit_type = 'central' and cu.is_active
        )
      )
  )
);

-- Uploading evidence no longer closes the report or completes assignments.
create or replace function public.agent_resolve_report(
  p_report_id uuid,
  p_media_id uuid,
  p_resolution_note text default null
)
returns public.reports
language plpgsql
security definer
set search_path = 'public', 'private'
as $function$
declare
  r public.reports;
  rm public.report_media;
  a public.report_assignments;
begin
  if (select auth.uid()) is null then
    raise exception 'Session requise.';
  end if;

  if not exists (
    select 1 from public.field_agents
    where user_id = (select auth.uid()) and is_active
  ) then
    raise exception 'Compte agent terrain inactif ou non autorisé.';
  end if;

  select * into r from public.reports where id = p_report_id for update;
  if r.id is null then raise exception 'Signalement introuvable.'; end if;
  if r.status <> 'in_progress' then
    raise exception 'Le signalement doit être en cours de traitement.';
  end if;

  select * into a
  from public.report_assignments
  where report_id = p_report_id
    and agent_id = (select auth.uid())
    and unassigned_at is null
    and assignment_status in ('assigned', 'accepted', 'in_progress')
  order by assigned_at desc
  limit 1;

  if a.id is null then
    raise exception 'Vous n''êtes pas affecté à ce signalement.';
  end if;

  select * into rm
  from public.report_media
  where id = p_media_id
    and report_id = p_report_id
    and media_role = 'resolution_video'
    and moderation_status = 'pending'
    and uploaded_by = (select auth.uid())
    and (
      media_type in ('video/mp4', 'video/webm', 'video/quicktime')
      or media_type in ('image/jpeg', 'image/png', 'image/webp')
    );

  if rm.id is null then
    raise exception 'La photo ou vidéo de résolution est introuvable ou non autorisée.';
  end if;
  if rm.captured_latitude is null or rm.captured_longitude is null then
    raise exception 'La preuve de résolution doit être géolocalisée.';
  end if;
  if r.latitude is null or r.longitude is null then
    raise exception 'Le signalement ne possède pas de coordonnées GPS.';
  end if;
  if earth_distance(
    ll_to_earth(r.latitude, r.longitude),
    ll_to_earth(rm.captured_latitude, rm.captured_longitude)
  ) > 20 then
    raise exception 'La preuve doit être publiée à 20 mètres ou moins du lieu du signalement.';
  end if;

  if exists (
    select 1 from public.report_media
    where report_id = p_report_id
      and media_role = 'resolution_video'
      and moderation_status = 'pending'
      and id <> p_media_id
  ) then
    raise exception 'Une preuve de résolution est déjà en attente de validation.';
  end if;

  return r;
end;
$function$;

-- Mairie validation: approval closes only mairie-handled reports; rejection leaves them active for rework.
create or replace function public.mairie_review_resolution_video(
  p_media_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = 'public', 'private'
as $function$
declare
  rm public.report_media;
  v_report_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Session requise.'; end if;

  select media.*, media.report_id into rm, v_report_id
  from public.report_media media
  join public.reports r on r.id = media.report_id
  join public.mairies m on m.commune_id = r.commune_id
  where media.id = p_media_id
    and media.media_role = 'resolution_video'
    and media.moderation_status = 'pending'
    and m.account_user_id = (select auth.uid())
    and m.is_active = true
    and not exists (
      select 1 from public.report_organization_transfers t
      where t.report_id = r.id
        and t.status in ('pending', 'accepted', 'completed')
    )
  for update of media;

  if rm.id is null then
    raise exception 'Preuve en attente introuvable ou mairie non autorisée.';
  end if;

  update public.report_media
  set moderation_status = case when p_approve then 'approved' else 'rejected' end,
      moderated_at = now(),
      moderated_by = (select auth.uid()),
      moderation_reason = case when p_approve then null else 'Résolution rejetée par la mairie.' end
  where id = p_media_id;

  if p_approve then
    update public.reports
    set status = 'resolved',
        resolution_note = 'Résolution approuvée par la mairie après vérification de la preuve terrain.',
        resolved_at = now(),
        updated_at = now()
    where id = v_report_id;

    update public.report_assignments
    set assignment_status = 'completed', completed_at = now()
    where report_id = v_report_id
      and unassigned_at is null
      and assignment_status in ('assigned', 'accepted', 'in_progress');
  end if;
end;
$function$;

-- Only the central organization that received the original mairie transfer can approve/reject.
create or replace function public.organization_review_resolution_media(
  p_media_id uuid,
  p_approve boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = 'public', 'private'
as $function$
declare
  rm public.report_media;
  v_report_id uuid;
  v_organization_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Session requise.'; end if;

  select media.*, media.report_id, t.organization_id
    into rm, v_report_id, v_organization_id
  from public.report_media media
  join public.report_organization_transfers t on t.report_id = media.report_id
  join public.organizations o on o.id = t.organization_id
  join public.organization_users ou on ou.organization_id = t.organization_id
  where media.id = p_media_id
    and media.media_role = 'resolution_video'
    and media.moderation_status = 'pending'
    and t.status in ('accepted', 'completed')
    and upper(o.code) in ('NIGELEC', 'NDE')
    and ou.user_id = (select auth.uid())
    and ou.is_active
    and ou.role in ('admin', 'supervisor')
    and (
      (ou.unit_id is null and exists (
        select 1 from public.organization_units cu
        where cu.organization_id = ou.organization_id
          and cu.unit_type = 'central' and cu.is_active
      ))
      or exists (
        select 1 from public.organization_units cu
        where cu.id = ou.unit_id
          and cu.organization_id = ou.organization_id
          and cu.unit_type = 'central' and cu.is_active
      )
    )
  for update of media;

  if rm.id is null then
    raise exception 'Preuve en attente introuvable ou centrale non autorisée.';
  end if;

  update public.report_media
  set moderation_status = case when p_approve then 'approved' else 'rejected' end,
      moderated_at = now(),
      moderated_by = (select auth.uid()),
      moderation_reason = case
        when p_approve then null
        else coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Résolution rejetée par la centrale.')
      end
  where id = p_media_id;

  if p_approve then
    update public.reports
    set status = 'resolved',
        resolution_note = 'Résolution approuvée par la centrale après vérification de la preuve terrain.',
        resolved_at = now(),
        updated_at = now()
    where id = v_report_id;

    update public.report_assignments
    set assignment_status = 'completed', completed_at = now()
    where report_id = v_report_id
      and unassigned_at is null
      and assignment_status in ('assigned', 'accepted', 'in_progress');

    update public.report_unit_assignments
    set status = 'completed',
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where report_id = v_report_id
      and organization_id = v_organization_id
      and unassigned_at is null
      and status in ('assigned', 'accepted', 'in_progress');

    update public.report_organization_transfers
    set status = 'completed', updated_at = now()
    where report_id = v_report_id
      and organization_id = v_organization_id
      and status = 'accepted';
  end if;
end;
$function$;

revoke all on function public.agent_resolve_report(uuid, uuid, text) from public, anon;
grant execute on function public.agent_resolve_report(uuid, uuid, text) to authenticated;
revoke all on function public.mairie_review_resolution_video(uuid, boolean) from public, anon;
grant execute on function public.mairie_review_resolution_video(uuid, boolean) to authenticated;
revoke all on function public.organization_review_resolution_media(uuid, boolean, text) from public, anon;
grant execute on function public.organization_review_resolution_media(uuid, boolean, text) to authenticated;
