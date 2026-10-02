-- Secure, auditable expiry cleanup for resolution-video archives.
-- A row is only marked deleted after Storage confirms removal (or the object is already absent).
create table if not exists public.cst_archive_cleanup_log (
  id uuid primary key default gen_random_uuid(),
  archive_id uuid not null,
  media_id uuid,
  report_id uuid,
  storage_path text,
  outcome text not null check (outcome in ('deleted','already_missing','failed')),
  details text,
  processed_at timestamptz not null default now()
);
alter table public.cst_archive_cleanup_log enable row level security;
revoke all on public.cst_archive_cleanup_log from anon, authenticated;
drop policy if exists cst_archive_cleanup_log_deny_client on public.cst_archive_cleanup_log;
create policy cst_archive_cleanup_log_deny_client on public.cst_archive_cleanup_log for all to anon, authenticated using(false) with check(false);
create index if not exists cst_archive_cleanup_log_processed_idx on public.cst_archive_cleanup_log(processed_at desc);
