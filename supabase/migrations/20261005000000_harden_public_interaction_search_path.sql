-- PCS: harden public citizen-interaction SECURITY DEFINER functions.
-- Keep the public RPC behavior intact while preventing object shadowing via search_path.
ALTER FUNCTION public.get_public_report_confirmation(uuid, uuid) SET search_path = '';
ALTER FUNCTION public.list_public_report_comments(uuid) SET search_path = '';
ALTER FUNCTION public.submit_public_report_comment(uuid, text, text, uuid) SET search_path = '';
ALTER FUNCTION public.toggle_public_report_confirmation(uuid, uuid) SET search_path = '';
