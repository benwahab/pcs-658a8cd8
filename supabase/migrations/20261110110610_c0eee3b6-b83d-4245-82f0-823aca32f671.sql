drop policy if exists roles_authenticated_read on public.roles;
drop policy if exists roles_select_authenticated on public.roles;
create policy roles_self_or_admin_read on public.roles for select to authenticated
using (
  private.has_role('admin')
  or exists (select 1 from public.user_roles ur where ur.role_id = roles.id and ur.user_id = (select auth.uid()))
);

drop policy if exists report_media_storage_owner_update on storage.objects;
drop policy if exists report_media_storage_owner_delete on storage.objects;