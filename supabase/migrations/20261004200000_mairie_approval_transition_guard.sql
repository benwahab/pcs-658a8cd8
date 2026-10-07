-- PCS: enforce one-way, admin-only transitions for mairie approval decisions.
-- This forward migration hardens the live RPCs without rewriting historical migrations.

create or replace function public.approve_mairie_request(p_mairie_id uuid)
returns public.mairies
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_mairie public.mairies;
begin
  if not private.has_role('admin') then
    raise exception 'Accès réservé aux administrateurs PCS';
  end if;

  select * into v_mairie
  from public.mairies
  where id = p_mairie_id
  for update;

  if not found then
    raise exception 'Demande mairie introuvable';
  end if;

  if v_mairie.approval_status is distinct from 'pending' then
    raise exception 'Cette demande mairie a déjà été traitée';
  end if;

  update public.mairies
  set approval_status = 'approved',
      is_active = true,
      updated_at = now()
  where id = p_mairie_id
  returning * into v_mairie;

  return v_mairie;
end;
$function$;

create or replace function public.reject_mairie_request(p_mairie_id uuid)
returns public.mairies
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_mairie public.mairies;
begin
  if not private.has_role('admin') then
    raise exception 'Accès réservé aux administrateurs PCS';
  end if;

  select * into v_mairie
  from public.mairies
  where id = p_mairie_id
  for update;

  if not found then
    raise exception 'Demande mairie introuvable';
  end if;

  if v_mairie.approval_status is distinct from 'pending' then
    raise exception 'Cette demande mairie a déjà été traitée';
  end if;

  update public.mairies
  set approval_status = 'rejected',
      is_active = false,
      updated_at = now()
  where id = p_mairie_id
  returning * into v_mairie;

  return v_mairie;
end;
$function$;

revoke all on function public.approve_mairie_request(uuid) from public, anon, authenticated;
revoke all on function public.reject_mairie_request(uuid) from public, anon, authenticated;
grant execute on function public.approve_mairie_request(uuid) to authenticated;
grant execute on function public.reject_mairie_request(uuid) to authenticated;
