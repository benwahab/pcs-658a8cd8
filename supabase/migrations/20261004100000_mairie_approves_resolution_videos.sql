-- Resolution videos are uploaded by field agents, reviewed only by the responsible mairie,
-- and become public carousel media only after explicit municipal approval.
drop policy if exists report_media_public_anon on public.report_media;
create policy report_media_public_anon
on public.report_media for select to anon
using (
  moderation_status = 'approved'
  and media_role in ('citizen_evidence', 'resolution_video')
  and exists (
    select 1 from public.reports r
    where r.id = report_media.report_id and r.is_public = true
  )
);

drop policy if exists report_media_public_read_authenticated on public.report_media;
create policy report_media_public_read_authenticated
on public.report_media for select to authenticated
using (
  moderation_status = 'approved'
  and media_role in ('citizen_evidence', 'resolution_video')
  and exists (
    select 1 from public.reports r
    where r.id = report_media.report_id and r.is_public = true
  )
);

drop policy if exists report_media_storage_public_read on storage.objects;
create policy report_media_storage_public_read
on storage.objects for select to public
using (
  bucket_id = 'report-media'
  and exists (
    select 1
    from public.report_media rm
    join public.reports r on r.id = rm.report_id
    where rm.storage_path = objects.name
      and r.is_public = true
      and rm.moderation_status = 'approved'
      and rm.media_role in ('citizen_evidence', 'resolution_video')
  )
);

drop policy if exists report_media_storage_mairie_resolution_read on storage.objects;
create policy report_media_storage_mairie_resolution_read
on storage.objects for select to authenticated
using (
  bucket_id = 'report-media'
  and exists (
    select 1
    from public.report_media rm
    join public.reports r on r.id = rm.report_id
    join public.mairies m on m.commune_id = r.commune_id
    where rm.storage_path = objects.name
      and rm.media_role = 'resolution_video'
      and m.account_user_id = auth.uid()
      and m.is_active = true
  )
);

create or replace function public.mairie_review_resolution_video(
  p_media_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  rm public.report_media;
begin
  if auth.uid() is null then raise exception 'Session requise.'; end if;

  select media.* into rm
  from public.report_media media
  join public.reports r on r.id = media.report_id
  join public.mairies m on m.commune_id = r.commune_id
  where media.id = p_media_id
    and media.media_role = 'resolution_video'
    and media.moderation_status = 'pending'
    and m.account_user_id = auth.uid()
    and m.is_active = true
  for update of media;

  if rm.id is null then
    raise exception 'Vidéo en attente introuvable ou mairie non autorisée.';
  end if;

  update public.report_media
  set moderation_status = case when p_approve then 'approved' else 'rejected' end
  where id = p_media_id;
end;
$$;

revoke all on function public.mairie_review_resolution_video(uuid, boolean) from public, anon;
grant execute on function public.mairie_review_resolution_video(uuid, boolean) to authenticated;

create or replace view public.public_report_media
with (security_invoker = true)
as
select
  rm.id,
  rm.report_id,
  rm.storage_path,
  rm.media_type,
  rm.file_size,
  rm.created_at,
  null::double precision as captured_latitude,
  null::double precision as captured_longitude,
  rm.media_role
from public.report_media rm
join public.reports r on r.id = rm.report_id
where r.is_public = true
  and rm.moderation_status = 'approved'
  and rm.media_role in ('citizen_evidence', 'resolution_video');

comment on view public.public_report_media is
  'Public carousel media: approved citizen evidence plus resolution videos approved by the responsible mairie; GPS coordinates remain hidden.';
