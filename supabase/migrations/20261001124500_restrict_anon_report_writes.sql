-- Citizen submissions are handled by the validated citizen-report-submit Edge
-- Function using the service role. Anonymous clients must not write directly to
-- the reports table; retain SELECT only for SECURITY INVOKER public views.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.reports FROM anon;
GRANT SELECT ON TABLE public.reports TO anon;
