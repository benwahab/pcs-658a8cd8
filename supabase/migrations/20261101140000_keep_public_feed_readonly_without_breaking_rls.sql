-- Preserve the established, narrowly-projected public feed views while keeping them read-only.
-- SECURITY DEFINER is intentional here: underlying RLS helper policies reference private staff
-- tables unavailable to anon. The view predicates expose only public reports with approved
-- citizen evidence and only approved public media; GPS columns remain omitted/redacted.
-- Write access is explicitly revoked from both views for every API role.
begin;
alter view public.public_reports set (security_invoker = false);
alter view public.public_report_media set (security_invoker = false);
revoke all privileges on table public.public_reports from anon, authenticated;
revoke all privileges on table public.public_report_media from anon, authenticated;
grant select on table public.public_reports to anon, authenticated;
grant select on table public.public_report_media to anon, authenticated;

do $$
begin
  if has_table_privilege('anon','public.public_reports','insert')
     or has_table_privilege('anon','public.public_reports','update')
     or has_table_privilege('anon','public.public_reports','delete')
     or has_table_privilege('authenticated','public.public_reports','insert')
     or has_table_privilege('authenticated','public.public_reports','update')
     or has_table_privilege('authenticated','public.public_reports','delete') then
    raise exception 'public_reports view still allows writes';
  end if;
  if has_table_privilege('anon','public.public_report_media','insert')
     or has_table_privilege('anon','public.public_report_media','update')
     or has_table_privilege('anon','public.public_report_media','delete')
     or has_table_privilege('authenticated','public.public_report_media','insert')
     or has_table_privilege('authenticated','public.public_report_media','update')
     or has_table_privilege('authenticated','public.public_report_media','delete') then
    raise exception 'public_report_media view still allows writes';
  end if;
  if not has_table_privilege('anon','public.public_reports','select')
     or not has_table_privilege('anon','public.public_report_media','select') then
    raise exception 'public feed read access was not preserved';
  end if;
end;
$$;
commit;
