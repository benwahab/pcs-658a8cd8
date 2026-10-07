-- SECURITY INVOKER views respect the caller's RLS policies. Preserve the
-- intended public-read experience while keeping rows limited to public reports
-- and approved media.
DROP POLICY IF EXISTS reports_public_read_authenticated ON public.reports;
CREATE POLICY reports_public_read_authenticated
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (is_public = true);

DROP POLICY IF EXISTS report_media_public_read_authenticated ON public.report_media;
CREATE POLICY report_media_public_read_authenticated
  ON public.report_media
  FOR SELECT
  TO authenticated
  USING (
    moderation_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_media.report_id
        AND r.is_public = true
    )
  );
