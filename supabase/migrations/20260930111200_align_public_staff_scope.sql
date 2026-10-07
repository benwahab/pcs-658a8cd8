-- Keep the legacy public staff helper aligned with the least-privilege staff scope.
-- Regional moderators are authorized only through the dedicated moderation backend.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.has_role('agent') or public.has_role('admin');
$$;
