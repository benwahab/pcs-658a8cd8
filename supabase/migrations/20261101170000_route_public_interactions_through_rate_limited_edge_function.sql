-- Citizen interactions remain anonymous, but write operations must pass through
-- the Edge Function so limits are enforced using the platform-provided client IP.
-- Read-only public RPCs remain available to the feed.
begin;

revoke all on function public.submit_public_report_comment(uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.toggle_public_report_confirmation(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.submit_public_report_comment(uuid, text, text, uuid)
  to service_role;
grant execute on function public.toggle_public_report_confirmation(uuid, uuid)
  to service_role;

do $$
begin
  if has_function_privilege('anon',
    'public.submit_public_report_comment(uuid,text,text,uuid)', 'execute')
     or has_function_privilege('authenticated',
    'public.submit_public_report_comment(uuid,text,text,uuid)', 'execute') then
    raise exception 'Anonymous or authenticated direct comment submission remains enabled';
  end if;
  if has_function_privilege('anon',
    'public.toggle_public_report_confirmation(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated',
    'public.toggle_public_report_confirmation(uuid,uuid)', 'execute') then
    raise exception 'Anonymous or authenticated direct confirmation toggle remains enabled';
  end if;
  if not has_function_privilege('service_role',
    'public.submit_public_report_comment(uuid,text,text,uuid)', 'execute')
     or not has_function_privilege('service_role',
    'public.toggle_public_report_confirmation(uuid,uuid)', 'execute') then
    raise exception 'Service role lost access to citizen interaction RPCs';
  end if;
end;
$$;

commit;
