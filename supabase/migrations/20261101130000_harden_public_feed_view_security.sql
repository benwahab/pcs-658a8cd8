-- Security hardening: keep the citizen feed publicly readable but strictly read-only.
-- Run views as the caller so underlying RLS policies remain authoritative.
begin;

alter view public.public_reports set (security_invoker = true);
alter view public.public_report_media set (security_invoker = true);

-- Views must never provide a write path around the reports table policies.
revoke all privileges on table public.public_reports from anon, authenticated;
revoke all privileges on table public.public_report_media from anon, authenticated;
grant select on table public.public_reports to anon, authenticated;
grant select on table public.public_report_media to anon, authenticated;

-- Invoker views require the caller to hold SELECT on their underlying relations.
-- The existing report_media RLS policies restrict anon to approved public media.
grant select on table public.report_media to anon;

-- Prevent newly-created public-schema tables/views from inheriting broad API grants.
-- Future API exposure must be explicit and paired with appropriate RLS policies.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke all privileges on tables from anon, authenticated;

do $$
begin
  if pg_relation_is_updatable('public.public_reports'::regclass, true) <> 0 then
    raise exception 'Security check failed: public_reports is still updatable';
  end if;
  if has_table_privilege('anon', 'public.public_reports', 'insert')
     or has_table_privilege('anon', 'public.public_reports', 'update')
     or has_table_privilege('anon', 'public.public_reports', 'delete') then
    raise exception 'Security check failed: anon can still write public_reports';
  end if;
  if has_table_privilege('authenticated', 'public.public_reports', 'insert')
     or has_table_privilege('authenticated', 'public.public_reports', 'update')
     or has_table_privilege('authenticated', 'public.public_reports', 'delete') then
    raise exception 'Security check failed: authenticated can still write public_reports view';
  end if;
  if not has_table_privilege('anon', 'public.report_media', 'select') then
    raise exception 'Security check failed: anon lacks SELECT required by the invoker media views';
  end if;
  if not exists (
    select 1 from pg_class c
    where c.oid = 'public.public_reports'::regclass
      and coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
  ) or not exists (
    select 1 from pg_class c
    where c.oid = 'public.public_report_media'::regclass
      and coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
  ) then
    raise exception 'Security check failed: public feed views are not security invoker';
  end if;
end;
$$;

commit;
