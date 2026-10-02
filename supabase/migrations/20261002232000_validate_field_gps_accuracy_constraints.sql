-- Reconcile constraints validated directly in production on 2026-10-02.
-- Keep the migration history aligned with the live database.
ALTER TABLE public.report_media
  VALIDATE CONSTRAINT report_media_resolution_accuracy_check;

ALTER TABLE public.report_field_verifications
  DROP CONSTRAINT IF EXISTS report_field_verifications_accuracy_check;

ALTER TABLE public.report_field_verifications
  ADD CONSTRAINT report_field_verifications_accuracy_check
  CHECK (accuracy_m IS NOT NULL AND accuracy_m >= 0 AND accuracy_m <= 20)
  NOT VALID;

ALTER TABLE public.report_field_verifications
  VALIDATE CONSTRAINT report_field_verifications_accuracy_check;
