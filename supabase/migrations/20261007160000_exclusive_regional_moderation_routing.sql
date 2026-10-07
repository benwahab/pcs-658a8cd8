-- Enforce exclusive regional moderation routing.
-- One active regional moderator may cover a region at a time.
create unique index if not exists moderator_profiles_one_active_per_region_idx
on public.moderator_profiles(region_id)
where is_active=true;

create or replace function private.active_moderator_for_region(p_region_id uuid)
returns uuid
language sql
stable
security definer
set search_path=public,private
as $$
  select mp.user_id
  from public.moderator_profiles mp
  where mp.region_id=p_region_id
    and mp.is_active=true
  limit 1;
$$;

revoke all on function private.active_moderator_for_region(uuid) from public, anon, authenticated;
grant execute on function private.active_moderator_for_region(uuid) to service_role;

-- Replace the previous mixed CST/regional authorization with exclusive routing:
-- covered region -> only its active moderator;
-- uncovered region -> CST fallback.
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
    and media_type like 'video/%'
  for update;

  if not found then
    raise exception 'video not found' using errcode='P0002';
  end if;

  if v_media.moderation_status <> 'pending' then
    raise exception 'video already moderated' using errcode='P0003';
  end if;

  select r.region_id
  into v_report_region
  from public.reports r
  where r.id=v_media.report_id;

  if v_report_region is null then
    raise exception 'report not found' using errcode='P0002';
  end if;

  v_assigned_moderator := private.active_moderator_for_region(v_report_region);
  v_is_cst := exists(
    select 1
    from public.cst_accounts
    where user_id=p_moderator_id
  );
  v_is_regional_moderator := exists(
    select 1
    from public.moderator_profiles mp
    where mp.user_id=p_moderator_id
      and mp.region_id=v_report_region
      and mp.is_active=true
  );

  if v_assigned_moderator is not null then
    if p_moderator_id <> v_assigned_moderator or not v_is_regional_moderator then
      raise exception 'video assigned to regional moderator' using errcode='42501';
    end if;
  else
    if not v_is_cst then
      raise exception 'video assigned to CST fallback' using errcode='42501';
    end if;
  end if;

  update public.report_media
  set moderation_status=p_action,
      moderated_at=v_now,
      moderated_by=p_moderator_id,
      moderation_reason=case
        when p_action='rejected' then nullif(trim(coalesce(p_reason,'')),'')
        else null
      end
  where id=p_media_id
    and moderation_status='pending';

  if not found then
    raise exception 'video already moderated' using errcode='P0003';
  end if;

  insert into public.cst_media_moderation_history(
    media_id,moderator_id,action,reason
  )
  values(
    p_media_id,
    p_moderator_id,
    p_action,
    case when p_action='rejected' then nullif(trim(coalesce(p_reason,'')),'') else null end
  );

  return query select p_action, v_media.storage_path;
end;
$$;

revoke all on function public.apply_cst_media_moderation(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.apply_cst_media_moderation(uuid,uuid,text,text) to service_role;
