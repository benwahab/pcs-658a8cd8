-- Anonymous citizen reactions/comments. Tokens identify a browser only;
-- no citizen account or personal identity is required.
CREATE TABLE IF NOT EXISTS public.public_report_confirmations (
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  visitor_token uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, visitor_token)
);

CREATE TABLE IF NOT EXISTS public.public_report_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  display_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_report_comments_body_length CHECK (char_length(trim(body)) BETWEEN 2 AND 1000),
  CONSTRAINT public_report_comments_display_name_length CHECK (display_name IS NULL OR char_length(trim(display_name)) BETWEEN 1 AND 60)
);

ALTER TABLE public.public_report_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_report_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_report_confirmations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.public_report_comments FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_report_confirmation(p_report_id uuid, p_visitor_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_confirmed boolean; v_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.public_reports pr WHERE pr.id = p_report_id) THEN
    RAISE EXCEPTION 'Public report not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.public_report_confirmations c WHERE c.report_id = p_report_id AND c.visitor_token = p_visitor_token) INTO v_confirmed;
  SELECT count(*)::integer INTO v_count FROM public.public_report_confirmations c WHERE c.report_id = p_report_id;
  RETURN jsonb_build_object('confirmed', v_confirmed, 'count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_public_report_confirmation(p_report_id uuid, p_visitor_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_confirmed boolean; v_count integer;
BEGIN
  IF p_visitor_token IS NULL THEN RAISE EXCEPTION 'Visitor token required' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.public_reports pr WHERE pr.id = p_report_id) THEN
    RAISE EXCEPTION 'Public report not found' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM public.public_report_confirmations WHERE report_id = p_report_id AND visitor_token = p_visitor_token;
  IF NOT FOUND THEN
    INSERT INTO public.public_report_confirmations(report_id, visitor_token) VALUES (p_report_id, p_visitor_token) ON CONFLICT DO NOTHING;
    v_confirmed := true;
  ELSE v_confirmed := false;
  END IF;
  SELECT count(*)::integer INTO v_count FROM public.public_report_confirmations c WHERE c.report_id = p_report_id;
  RETURN jsonb_build_object('confirmed', v_confirmed, 'count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_public_report_comments(p_report_id uuid)
RETURNS TABLE(id uuid, display_name text, body text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.public_reports pr WHERE pr.id = p_report_id) THEN
    RAISE EXCEPTION 'Public report not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY SELECT c.id, c.display_name, c.body, c.created_at FROM public.public_report_comments c WHERE c.report_id = p_report_id ORDER BY c.created_at ASC LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_report_comment(p_report_id uuid, p_body text, p_display_name text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.public_reports pr WHERE pr.id = p_report_id) THEN
    RAISE EXCEPTION 'Public report not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_body IS NULL OR char_length(trim(p_body)) NOT BETWEEN 2 AND 1000 THEN
    RAISE EXCEPTION 'Comment must contain between 2 and 1000 characters' USING ERRCODE = '22023';
  END IF;
  IF p_display_name IS NOT NULL AND char_length(trim(p_display_name)) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Display name must contain between 1 and 60 characters' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.public_report_comments(report_id, display_name, body) VALUES (p_report_id, nullif(trim(p_display_name), ''), trim(p_body)) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_report_confirmation(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_public_report_confirmation(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_public_report_comments(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_public_report_comment(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_report_confirmation(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_public_report_confirmation(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_report_comments(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_report_comment(uuid, text, text) TO anon, authenticated;