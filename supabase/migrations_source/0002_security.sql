-- PCS security baseline: roles, helpers and RLS
create or replace function public.has_role(required_role text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = required_role
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.has_role('agent')
      or public.has_role('moderator')
      or public.has_role('admin');
$$;

revoke all on function public.has_role(text) from public;
revoke all on function public.is_staff() from public;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.is_staff() to authenticated;

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.departments enable row level security;
alter table public.reports enable row level security;
alter table public.report_media enable row level security;
alter table public.report_status_history enable row level security;
alter table public.report_assignments enable row level security;
alter table public.report_comments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select to authenticated using (is_active = true or public.is_staff());

drop policy if exists departments_staff_read on public.departments;
create policy departments_staff_read on public.departments for select to authenticated using (public.is_staff());

drop policy if exists reports_owner_select on public.reports;
create policy reports_owner_select on public.reports for select to authenticated using (citizen_id = auth.uid() or public.is_staff());
drop policy if exists reports_owner_insert on public.reports;
create policy reports_owner_insert on public.reports for insert to authenticated with check (citizen_id = auth.uid());
drop policy if exists reports_staff_update on public.reports;
create policy reports_staff_update on public.reports for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists media_owner_select on public.report_media;
create policy media_owner_select on public.report_media for select to authenticated using (
 exists(select 1 from public.reports r where r.id = report_id and (r.citizen_id = auth.uid() or public.is_staff()))
);
drop policy if exists media_owner_insert on public.report_media;
create policy media_owner_insert on public.report_media for insert to authenticated with check (
 exists(select 1 from public.reports r where r.id = report_id and r.citizen_id = auth.uid())
);

drop policy if exists history_visible on public.report_status_history;
create policy history_visible on public.report_status_history for select to authenticated using (
 exists(select 1 from public.reports r where r.id = report_id and (r.citizen_id = auth.uid() or public.is_staff()))
);

drop policy if exists assignments_staff on public.report_assignments;
create policy assignments_staff on public.report_assignments for select to authenticated using (public.is_staff());
drop policy if exists assignments_staff_write on public.report_assignments;
create policy assignments_staff_write on public.report_assignments for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists comments_visible on public.report_comments;
create policy comments_visible on public.report_comments for select to authenticated using (
 author_id = auth.uid()
 or public.is_staff()
 or (visibility = 'public' and exists(select 1 from public.reports r where r.id = report_id and r.citizen_id = auth.uid()))
);
drop policy if exists comments_staff_write on public.report_comments;
create policy comments_staff_write on public.report_comments for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists notifications_self on public.notifications;
create policy notifications_self on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_self_update on public.notifications;
create policy notifications_self_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists audit_admin_read on public.audit_logs;
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.has_role('admin'));

insert into public.roles(code,name) values
 ('citizen','Citoyen'),('agent','Agent'),('moderator','Modérateur'),('admin','Administrateur')
on conflict(code) do update set name=excluded.name;
