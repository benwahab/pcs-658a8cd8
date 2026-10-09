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
