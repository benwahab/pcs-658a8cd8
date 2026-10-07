-- PCS security layer
-- Review business-role names before production deployment.

insert into public.roles (code,name) values
('citizen','Citoyen'),
('agent','Agent'),
('moderator','Modérateur'),
('admin','Administrateur')
on conflict (code) do nothing;

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

create or replace function public.has_role(required_role text)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=auth.uid() and r.code=required_role
  );
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path=public
as $$
  select public.has_role('agent') or public.has_role('moderator') or public.has_role('admin');
$$;

create or replace function public.set_report_reference()
returns trigger language plpgsql
as $$
begin
  if new.reference_code is null or new.reference_code='' then
    new.reference_code := 'PCS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  end if;
  return new;
end;
$$;

drop trigger if exists reports_reference_trigger on public.reports;
create trigger reports_reference_trigger
before insert on public.reports
for each row execute function public.set_report_reference();

create policy profiles_select_self on public.profiles for select using (id=auth.uid() or public.has_role('admin'));
create policy profiles_update_self on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());

create policy roles_select_authenticated on public.roles for select to authenticated using (true);
create policy categories_select_active on public.categories for select to authenticated using (is_active=true or public.has_role('admin'));
create policy categories_admin_write on public.categories for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy departments_select_authenticated on public.departments for select to authenticated using (is_active=true or public.has_role('admin'));
create policy departments_admin_write on public.departments for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy reports_insert_own on public.reports for insert to authenticated with check (citizen_id=auth.uid());
create policy reports_select_own on public.reports for select to authenticated using (citizen_id=auth.uid() or public.is_staff());
create policy reports_update_staff on public.reports for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy media_select_authorized on public.report_media for select to authenticated using (
  exists(select 1 from public.reports r where r.id=report_id and (r.citizen_id=auth.uid() or public.is_staff()))
);
create policy media_insert_authorized on public.report_media for insert to authenticated with check (
  exists(select 1 from public.reports r where r.id=report_id and r.citizen_id=auth.uid())
);

create policy history_select_authorized on public.report_status_history for select to authenticated using (
  exists(select 1 from public.reports r where r.id=report_id and (r.citizen_id=auth.uid() or public.is_staff()))
);
create policy history_staff_insert on public.report_status_history for insert to authenticated with check (public.is_staff());

create policy assignments_staff on public.report_assignments for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy comments_authorized_select on public.report_comments for select to authenticated using (
  author_id=auth.uid() or exists(select 1 from public.reports r where r.id=report_id and (r.citizen_id=auth.uid() or public.is_staff()))
);
create policy comments_staff_insert on public.report_comments for insert to authenticated with check (author_id=auth.uid() and public.is_staff());

create policy notifications_own on public.notifications for select to authenticated using (user_id=auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy audit_admin_select on public.audit_logs for select to authenticated using (public.has_role('admin'));
create policy audit_staff_insert on public.audit_logs for insert to authenticated with check (actor_id=auth.uid() and public.is_staff());
