-- Remove broad default API table grants from audit and notification records.
-- Writes are performed by trusted database triggers / service-role functions.
begin;
revoke all privileges on table public.audit_logs from anon, authenticated;
grant select on table public.audit_logs to authenticated;

revoke all privileges on table public.notifications from anon, authenticated;
grant select, update on table public.notifications to authenticated;

do $$
begin
  if has_table_privilege('anon','public.audit_logs','select')
     or has_table_privilege('anon','public.audit_logs','insert')
     or has_table_privilege('anon','public.audit_logs','update')
     or has_table_privilege('anon','public.audit_logs','delete') then
    raise exception 'Anonymous access remains on audit_logs';
  end if;
  if has_table_privilege('authenticated','public.audit_logs','insert')
     or has_table_privilege('authenticated','public.audit_logs','update')
     or has_table_privilege('authenticated','public.audit_logs','delete') then
    raise exception 'Authenticated write access remains on audit_logs';
  end if;
  if has_table_privilege('anon','public.notifications','select')
     or has_table_privilege('anon','public.notifications','insert')
     or has_table_privilege('anon','public.notifications','update')
     or has_table_privilege('anon','public.notifications','delete') then
    raise exception 'Anonymous access remains on notifications';
  end if;
  if has_table_privilege('authenticated','public.notifications','insert')
     or has_table_privilege('authenticated','public.notifications','delete') then
    raise exception 'Unexpected authenticated write access remains on notifications';
  end if;
end;
$$;
commit;
