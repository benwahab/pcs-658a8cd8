-- Add covering indexes for foreign keys identified by the Supabase performance advisor.
-- These indexes do not change access rules or application/business logic.
CREATE INDEX IF NOT EXISTS cst_media_moderation_history_moderator_id_idx
  ON public.cst_media_moderation_history (moderator_id);

CREATE INDEX IF NOT EXISTS cst_video_archives_report_id_idx
  ON public.cst_video_archives (report_id);

CREATE INDEX IF NOT EXISTS organization_signup_requests_organization_id_idx
  ON public.organization_signup_requests (organization_id);

CREATE INDEX IF NOT EXISTS organization_signup_requests_reviewed_by_idx
  ON public.organization_signup_requests (reviewed_by);

CREATE INDEX IF NOT EXISTS public_report_comments_report_id_idx
  ON public.public_report_comments (report_id);

CREATE INDEX IF NOT EXISTS report_confirmations_user_id_idx
  ON public.report_confirmations (user_id);

CREATE INDEX IF NOT EXISTS report_media_moderated_by_idx
  ON public.report_media (moderated_by);
