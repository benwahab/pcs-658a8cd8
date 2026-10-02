-- Central archive index for resolution videos. The file stays in the private report-media bucket;
-- this table records lifecycle metadata and never creates a second copy of the media.
create table if not exists public.cst_video_archives (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null unique references public.report_media(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  archived_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 months'),
  hold_reason text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cst_video_archives_expires_at_idx
  on public.cst_video_archives (expires_at) where deleted_at is null;

alter table public.cst_video_archives enable row level security;
revoke all on public.cst_video_archives from anon, authenticated;
drop policy if exists cst_video_archives_deny_client_access on public.cst_video_archives;
create policy cst_video_archives_deny_client_access on public.cst_video_archives
  for all to anon, authenticated using (false) with check (false);

create or replace function public.register_resolution_video_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.media_role = 'resolution_video' then
    insert into public.cst_video_archives(media_id, report_id, archived_at, expires_at)
    values (new.id, new.report_id, now(), now() + interval '12 months')
    on conflict (media_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists report_media_register_resolution_archive on public.report_media;
create trigger report_media_register_resolution_archive
after insert on public.report_media
for each row execute function public.register_resolution_video_archive();

-- Existing resolution videos are indexed without copying their storage objects.
insert into public.cst_video_archives(media_id, report_id, archived_at, expires_at)
select rm.id, rm.report_id, coalesce(rm.created_at, now()), coalesce(rm.created_at, now()) + interval '12 months'
from public.report_media rm
where rm.media_role = 'resolution_video'
on conflict (media_id) do nothing;
