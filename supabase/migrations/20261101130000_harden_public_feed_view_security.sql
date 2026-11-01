-- Keep citizen feed readable, but remove every write grant from public views.
-- SECURITY INVOKER makes the underlying table RLS policies apply to the caller.
begin;
alter view public.public_reports set (security_invoker = true);
alter view public.public_report_media set (security_invoker = true);
revoke all privileges on table public.public_reports from anon, authenticated;
revoke all privileges on table public.public_report_media from anon, authenticated;
grant select on table public.public_reports to anon, authenticated;
grant select on table public.public_report_media to anon, authenticated;
grant select on table public.report_media to anon;

do $$
begin
  if has_table_privilege('anon', 'public.public_reports', 'insert')
     or has_table_privilege('anon', 'public.public_reports', 'update')
     or has_table_privilege('anon', 'public.public_reports', 'delete')
     or has_table_privilege('authenticated', 'public.public_reports', 'insert')
     or has_table_privilege('authenticated', 'public.public_reports', 'update')
     or has_table_privilege('authenticated', 'public.public_reports', 'delete') then
    raise exception 'Security check failed: public_reports view still allows writes';
  end if;
  if has_table_privilege('anon', 'public.public_report_media', 'insert')
     or has_table_privilege('anon', 'public.public_report_media', 'update')
     or has_table_privilege('anon', 'public.public_report_media', 'delete')
     or has_table_privilege('authenticated', 'public.public_report_media', 'insert')
     or has_table_privilege('authenticated', 'public.public_report_media', 'update')
     or has_table_privilege('authenticated', 'public.public_report_media', 'delete') then
    raise exception 'Security check failed: public_report_media view still allows writes';
  end if;
  if not has_table_privilege('anon', 'public.report_media', 'select') then
    raise exception 'Security check failed: anon lacks SELECT on report_media';
  end if;
  if not exists (select 1 from pg_class where oid='public.public_reports'::regclass and coalesce(reloptions,array[]::text[]) @> array['security_invoker=true'])
     or not exists (select 1 from pg_class where oid='public.public_report_media'::regclass and coalesce(reloptions,array[]::text[]) @> array['security_invoker=true']) then
    raise exception 'Security check failed: public views are not security invoker';
  end if;
end;
$$;
commit;
