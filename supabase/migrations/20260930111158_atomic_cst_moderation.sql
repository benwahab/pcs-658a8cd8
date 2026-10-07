-- Make each moderation decision and its audit entry one database transaction.
-- The edge function performs authentication/authorization before calling this RPC,
-- and the function repeats the authorization checks so the invariant is server-side.
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
  v_is_cst boolean := false;
  v_is_moderator boolean := false;
  v_moderator_region uuid;
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

  select exists(select 1 from public.cst_accounts where user_id=p_moderator_id) into v_is_cst;
  select mp.region_id into v_moderator_region
  from public.moderator_profiles mp
  where mp.user_id=p_moderator_id and mp.is_active=true;
  v_is_moderator := v_moderator_region is not null;

  select r.region_id into v_report_region
  from public.reports r
  where r.id=v_media.report_id;
  if v_report_region is null then
    raise exception 'report not found' using errcode='P0002';
  end if;

  if not v_is_cst and not v_is_moderator then
    raise exception 'moderation access denied' using errcode='42501';
  end if;
  if v_is_moderator and v_report_region <> v_moderator_region then
    raise exception 'region access denied' using errcode='42501';
  end if;

  update public.report_media
  set moderation_status=p_action,
      moderated_at=v_now,
      moderated_by=p_moderator_id,
      moderation_reason=case when p_action='rejected' then nullif(trim(coalesce(p_reason,'')),'') else null end
  where id=p_media_id and moderation_status='pending';

  if not found then
    raise exception 'video already moderated' using errcode='P0003';
  end if;

  insert into public.cst_media_moderation_history(media_id,moderator_id,action,reason)
  values(p_media_id,p_moderator_id,p_action,case when p_action='rejected' then nullif(trim(coalesce(p_reason,'')),'') else null end);

  return query select p_action, v_media.storage_path;
end;
$$;

revoke all on function public.apply_cst_media_moderation(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.apply_cst_media_moderation(uuid,uuid,text,text) to service_role;
