-- Restore public read access to the public_reports view used by the citizen feed.
-- The view itself only exposes reports with is_public = true.
grant select on table public.public_reports to anon, authenticated;
