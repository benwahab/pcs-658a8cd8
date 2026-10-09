-- Require CST moderation for all citizen evidence, including photos.
-- Keep agent resolution media on its existing workflow and preserve regional routing.
alter table public.report_media
  alter column moderation_status set default 'pending';

create or replace function public.prepare_report_media_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.media_role = 'citizen_evidence' then
    new.moderation_status := 'pending';
    new.moderated_at := null;
    new.moderated_by := null;
    new.moderation_reason := null;
  elsif new.media_role = 'resolution_video' then
    new.moderation_status := 'pending';
    new.moderated_at := null;
    new.moderated_by := null;
    new.moderation_reason := null;
  else
    new.moderation_status := 'approved';
  end if;
  return new;
end;
$function$;

-- Older citizen photos were auto-approved by the previous trigger/function.
-- Return only photos without any recorded moderation decision to the review queue.
update public.report_media rm
set moderation_status = 'pending',
    moderated_at = null,
    moderated_by = null,
    moderation_reason = null
where rm.media_role = 'citizen_evidence'
  and rm.media_type like 'image/%'
  and rm.moderation_status = 'approved'
  and not exists (
    select 1
    from public.cst_media_moderation_history h
    where h.media_id = rm.id
  );

-- Prevent direct authenticated inserts from bypassing moderation.
drop policy if exists media_insert on public.report_media;
create policy media_insert on public.report_media
for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and (
    (
      media_role = 'citizen_evidence'
      and moderation_status = 'pending'
      and media_type like 'image/%'
      and exists (
        select 1 from public.reports r
        where r.id = report_media.report_id
          and r.citizen_id = (select auth.uid())
      )
    )
    or
    (
      media_role = 'citizen_evidence'
      and moderation_status = 'pending'
      and media_type like 'video/%'
      and exists (
        select 1 from public.reports r
        where r.id = report_media.report_id
          and r.citizen_id = (select auth.uid())
      )
    )
    or
    (
      media_role = 'resolution_video'
      and moderation_status = 'pending'
      and media_type like 'video/%'
      and captured_latitude is not null
      and captured_longitude is not null
      and accuracy_m is not null
      and accuracy_m between 0 and 20
      and file_size is not null
      and file_size between 1 and 104857600
      and exists (
        select 1
        from public.report_assignments ra
        join public.reports r on r.id = ra.report_id
        where ra.report_id = report_media.report_id
          and ra.agent_id = (select auth.uid())
          and ra.unassigned_at is null
          and ra.assignment_status in ('assigned','accepted','in_progress')
          and r.status = 'in_progress'
          and r.latitude is not null
          and r.longitude is not null
          and earth_distance(
            ll_to_earth(r.latitude, r.longitude),
            ll_to_earth(report_media.captured_latitude, report_media.captured_longitude)
          ) <= 20
      )
    )
  )
);


-- Reuse the existing atomic CST decision path for both citizen photos and videos.
-- Authorization and regional routing remain enforced inside the database function.
create or replace function public.apply_cst_media_moderation(
  p_media_id uuid,
  p_moderator_id uuid,
  p_action text,
  p_reason text default null
)
returns table(status text, storage_path text)
language plpgsql
security definer
set search_path=public,private
as $$
declare
  v_media public.report_media%rowtype;
  v_report_region uuid;
  v_assigned_moderator uuid;
  v_is_cst boolean := false;
  v_is_regional_moderator boolean := false;
  v_now timestamptz := now();
begin
  if p_action not in ('approved','rejected') then
    raise exception 'invalid moderation action' using errcode='22023';
  end if;

  select * into v_media
  from public.report_media
  where id=p_media_id
    and media_role='citizen_evidence'
    and (media_type like 'video/%' or media_type like 'image/%')
  for update;

  if not found then
    raise exception 'media not found' using errcode='P0002';
  end if;

  if v_media.moderation_status <> 'pending' then
    raise exception 'media already moderated' using errcode='P0003';
  end if;

  select r.region_id into v_report_region
  from public.reports r
  where r.id=v_media.report_id;

  if v_report_region is null then
    raise exception 'report not found' using errcode='P0002';
  end if;

  v_assigned_moderator := private.active_moderator_for_region(v_report_region);
  v_is_cst := exists(select 1 from public.cst_accounts where user_id=p_moderator_id);
  v_is_regional_moderator := exists(
    select 1 from public.moderator_profiles mp
    where mp.user_id=p_moderator_id
      and mp.region_id=v_report_region
      and mp.is_active=true
  );

  if v_assigned_moderator is not null then
    if p_moderator_id <> v_assigned_moderator or not v_is_regional_moderator then
      raise exception 'media assigned to regional moderator' using errcode='42501';
    end if;
  else
    if not v_is_cst then
      raise exception 'media assigned to CST fallback' using errcode='42501';
    end if;
  end if;

  update public.report_media
  set moderation_status=p_action,
      moderated_at=v_now,
      moderated_by=p_moderator_id,
      moderation_reason=case when p_action='rejected' then nullif(trim(coalesce(p_reason,'')),'') else null end
  where id=p_media_id and moderation_status='pending';

  if not found then
    raise exception 'media already moderated' using errcode='P0003';
  end if;

  insert into public.cst_media_moderation_history(media_id,moderator_id,action,reason)
  values(p_media_id,p_moderator_id,p_action,case when p_action='rejected' then nullif(trim(coalesce(p_reason,'')),'') else null end);

  return query select p_action, v_media.storage_path;
end;
$$;

revoke all on function public.apply_cst_media_moderation(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.apply_cst_media_moderation(uuid,uuid,text,text) to service_role;
