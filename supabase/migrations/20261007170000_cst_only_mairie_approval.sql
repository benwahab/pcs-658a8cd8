-- PCS: mairie account approval is a CST governance action, not a generic admin action.
-- Keep the existing admin role as a technical prerequisite only where applicable;
-- the decisive authorization is membership in cst_accounts.

create or replace function public.list_pending_mairie_requests()
returns table(
  id uuid,name text,region_id uuid,region_name text,commune_id uuid,commune_name text,
  account_user_id uuid,phone text,mayor_name text,latitude double precision,longitude double precision,
  location_label text,is_active boolean,approval_status text,created_at timestamptz
)
language sql
stable
security definer
set search_path='public','private'
as $function$
  select
    m.id,m.name,m.region_id,r.name,m.commune_id,c.name,m.account_user_id,m.phone,m.mayor_name,
    m.latitude,m.longitude,m.location_label,m.is_active,m.approval_status,m.created_at
  from public.mairies m
  join public.regions r on r.id=m.region_id
  join public.communes c on c.id=m.commune_id
  where exists (
    select 1 from public.cst_accounts ca
    where ca.user_id=(select auth.uid())
  )
    and m.approval_status='pending'
  order by m.created_at desc
$function$;

create or replace function public.approve_mairie_request(p_mairie_id uuid)
returns public.mairies
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_mairie public.mairies;
begin
  if not exists (
    select 1 from public.cst_accounts ca
    where ca.user_id=(select auth.uid())
  ) then
    raise exception 'Accès réservé au CST';
  end if;

  select * into v_mairie
  from public.mairies
  where id=p_mairie_id
  for update;

  if not found then
    raise exception 'Demande mairie introuvable';
  end if;

  if v_mairie.approval_status is distinct from 'pending' then
    raise exception 'Cette demande mairie a déjà été traitée';
  end if;

  update public.mairies
  set approval_status='approved',
      is_active=true,
      updated_at=now()
  where id=p_mairie_id
  returning * into v_mairie;

  return v_mairie;
end;
$function$;

create or replace function public.reject_mairie_request(p_mairie_id uuid)
returns public.mairies
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_mairie public.mairies;
begin
  if not exists (
    select 1 from public.cst_accounts ca
    where ca.user_id=(select auth.uid())
  ) then
    raise exception 'Accès réservé au CST';
  end if;

  select * into v_mairie
  from public.mairies
  where id=p_mairie_id
  for update;

  if not found then
    raise exception 'Demande mairie introuvable';
  end if;

  if v_mairie.approval_status is distinct from 'pending' then
    raise exception 'Cette demande mairie a déjà été traitée';
  end if;

  update public.mairies
  set approval_status='rejected',
      is_active=false,
      updated_at=now()
  where id=p_mairie_id
  returning * into v_mairie;

  return v_mairie;
end;
$function$;

revoke execute on function public.list_pending_mairie_requests() from public,anon;
grant execute on function public.list_pending_mairie_requests() to authenticated;

revoke execute on function public.approve_mairie_request(uuid) from public,anon;
grant execute on function public.approve_mairie_request(uuid) to authenticated;

revoke execute on function public.reject_mairie_request(uuid) from public,anon;
grant execute on function public.reject_mairie_request(uuid) to authenticated;
