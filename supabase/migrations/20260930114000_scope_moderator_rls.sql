-- Regional moderators must not inherit the global staff RLS scope.
-- Their moderation access is enforced by the dedicated server-side moderation function.
create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path=public,private
as $$
  select exists(
    select 1
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=auth.uid()
      and r.code in ('agent','admin')
  );
$$;
