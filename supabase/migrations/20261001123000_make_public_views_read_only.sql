-- Public reporting views are read-only API surfaces. Remove inherited/default
-- write privileges so clients can only read the rows filtered by the views and RLS.
REVOKE ALL PRIVILEGES ON TABLE public.public_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.public_report_media FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.public_reports TO anon, authenticated;
GRANT SELECT ON TABLE public.public_report_media TO anon, authenticated;
