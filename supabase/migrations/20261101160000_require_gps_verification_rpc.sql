DROP POLICY IF EXISTS verification_insert ON public.report_field_verifications;
REVOKE INSERT ON TABLE public.report_field_verifications FROM anon, authenticated;
