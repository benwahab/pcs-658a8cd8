-- Enforce caller privileges and underlying RLS for public read-only views.
ALTER VIEW public.public_reports SET (security_invoker = true);
ALTER VIEW public.public_report_media SET (security_invoker = true);

-- Keep public media visible only through the approved/public RLS policy,
-- while granting anon only the columns required by the public media view.
GRANT SELECT (
  id,
  report_id,
  storage_path,
  media_type,
  file_size,
  created_at,
  captured_latitude,
  captured_longitude,
  media_role,
  moderation_status
) ON TABLE public.report_media TO anon;

-- Status history is an internal audit trail, not a public API resource.
REVOKE ALL ON TABLE public.report_status_history FROM anon, authenticated;
GRANT SELECT ON TABLE public.report_status_history TO authenticated;
DROP POLICY IF EXISTS report_status_history_staff_read ON public.report_status_history;
CREATE POLICY report_status_history_staff_read
  ON public.report_status_history
  FOR SELECT
  TO authenticated
  USING (private.is_staff());

-- These are trigger functions. Triggers do not require callers to have direct
-- EXECUTE permission, so remove unnecessary RPC exposure without breaking them.
REVOKE EXECUTE ON FUNCTION public.create_organization_signup_request_from_auth()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prepare_report_media_moderation()
  FROM PUBLIC, anon, authenticated;
