-- Citizen interactions on public reports. Only authenticated users may react or comment.
CREATE TABLE IF NOT EXISTS public.report_confirmations (
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, user_id)
);

ALTER TABLE public.report_confirmations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.report_confirmations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.report_confirmations TO authenticated;

DROP POLICY IF EXISTS report_confirmations_read_own ON public.report_confirmations;
CREATE POLICY report_confirmations_read_own
  ON public.report_confirmations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS report_confirmations_insert_own_public_report ON public.report_confirmations;
CREATE POLICY report_confirmations_insert_own_public_report
  ON public.report_confirmations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.public_reports pr WHERE pr.id = report_id)
  );

DROP POLICY IF EXISTS report_confirmations_delete_own ON public.report_confirmations;
CREATE POLICY report_confirmations_delete_own
  ON public.report_confirmations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Public comments are readable on public reports; writers can only publish
-- their own public comment, with a bounded body. Internal notes stay staff-only.
DROP POLICY IF EXISTS comments_public_read ON public.report_comments;
CREATE POLICY comments_public_read
  ON public.report_comments FOR SELECT TO anon, authenticated
  USING (
    visibility = 'public'
    AND EXISTS (SELECT 1 FROM public.public_reports pr WHERE pr.id = report_id)
  );

DROP POLICY IF EXISTS comments_citizen_public_insert ON public.report_comments;
CREATE POLICY comments_citizen_public_insert
  ON public.report_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND visibility = 'public'
    AND char_length(trim(body)) BETWEEN 2 AND 1000
    AND EXISTS (SELECT 1 FROM public.public_reports pr WHERE pr.id = report_id)
  );

GRANT SELECT (id, report_id, author_id, body, visibility, created_at)
  ON TABLE public.report_comments TO anon, authenticated;
GRANT INSERT (report_id, author_id, body, visibility)
  ON TABLE public.report_comments TO authenticated;
