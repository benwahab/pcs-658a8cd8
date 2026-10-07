-- Keep SECURITY DEFINER RLS helpers outside the exposed public schema.
create schema if not exists private;

create or replace function private.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=auth.uid() and r.code=required_role
  );
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=auth.uid()
      and r.code in ('agent','moderator','admin')
  );
$$;

revoke all on schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
revoke execute on function public.has_role(text) from public,anon,authenticated;
revoke execute on function public.is_staff() from public,anon,authenticated;
grant execute on function private.has_role(text) to authenticated;
grant execute on function private.is_staff() to authenticated;

drop policy if exists audit_admin on public.audit_logs;
create policy audit_admin on public.audit_logs for select to authenticated using (private.has_role('admin'));

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select to authenticated using (is_active or private.is_staff());

drop policy if exists departments_staff on public.departments;
create policy departments_staff on public.departments for select to authenticated using (private.is_staff());

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select to authenticated using ((id=auth.uid()) or private.is_staff());

drop policy if exists assignments_staff on public.report_assignments;
create policy assignments_staff on public.report_assignments for all to authenticated using (private.is_staff()) with check (private.is_staff());

drop policy if exists comments_read on public.report_comments;
create policy comments_read on public.report_comments for select to authenticated using ((author_id=auth.uid()) or private.is_staff());

drop policy if exists comments_staff on public.report_comments;
create policy comments_staff on public.report_comments for all to authenticated using (private.is_staff()) with check (private.is_staff());

drop policy if exists media_read on public.report_media;
create policy media_read on public.report_media for select to authenticated using (
  exists(select 1 from public.reports r where r.id=report_media.report_id
    and ((r.citizen_id=auth.uid()) or private.is_staff()))
);

drop policy if exists history_read on public.report_status_history;
create policy history_read on public.report_status_history for select to authenticated using (
  exists(select 1 from public.reports r where r.id=report_status_history.report_id
    and ((r.citizen_id=auth.uid()) or private.is_staff()))
);

drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select to authenticated using ((citizen_id=auth.uid()) or private.is_staff());

drop policy if exists reports_staff_update on public.reports;
create policy reports_staff_update on public.reports for update to authenticated using (private.is_staff()) with check (private.is_staff());

drop policy if exists user_roles_self_read on public.user_roles;
create policy user_roles_self_read on public.user_roles for select to authenticated using ((user_id=auth.uid()) or private.has_role('admin'));
