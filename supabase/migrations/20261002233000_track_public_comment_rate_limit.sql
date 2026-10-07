-- Keep anonymous public-comment rate limiting reproducible from migration history.
ALTER TABLE public.public_report_comments
  ADD COLUMN IF NOT EXISTS visitor_token uuid;

CREATE OR REPLACE FUNCTION public.submit_public_report_comment(
  p_report_id uuid,
  p_body text,
  p_display_name text DEFAULT NULL,
  p_visitor_token uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_id uuid;
  v_recent_count integer;
BEGIN
  IF p_visitor_token IS NULL THEN
    RAISE EXCEPTION 'Visitor token required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.public_reports pr WHERE pr.id = p_report_id
  ) THEN
    RAISE EXCEPTION 'Public report not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_body IS NULL OR char_length(trim(p_body)) NOT BETWEEN 2 AND 1000 THEN
    RAISE EXCEPTION 'Comment must contain between 2 and 1000 characters' USING ERRCODE = '22023';
  END IF;

  IF p_display_name IS NOT NULL AND char_length(trim(p_display_name)) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Display name must contain between 1 and 60 characters' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_visitor_token::text, 0));

  SELECT count(*)::integer INTO v_recent_count
  FROM public.public_report_comments c
  WHERE c.visitor_token = p_visitor_token
    AND c.created_at > now() - interval '1 hour';

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Comment rate limit exceeded. Try again later.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.public_report_comments(report_id, display_name, body, visitor_token)
  VALUES (p_report_id, nullif(trim(p_display_name), ''), trim(p_body), p_visitor_token)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_public_report_comment(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_report_comment(uuid, text, text, uuid) TO anon, authenticated, service_role;
