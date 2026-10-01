-- PCS: make mairie signup review workflow explicit and admin-only.
-- Existing inactive mairie records are treated as pending; active records as approved.

alter table public.mairies
  add column if not exists approval_status text;

update public.mairies
set approval_status = case when is_active then 'approved' else 'pending' end
where approval_status is null;

alter table public.mairies
  alter column approval_status set default 'approved',
  alter column approval_status set not null;

alter table public.mairies
  drop constraint if exists mairies_approval_status_check;

alter table public.mairies
  add constraint mairies_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));

create index if not exists mairies_approval_status_created_idx
  on public.mairies (approval_status, created_at desc);

create or replace function public.list_pending_mairie_requests()
returns table (
  id uuid,
  name text,
  region_id uuid,
  region_name text,
  commune_id uuid,
  commune_name text,
  account_user_id uuid,
  phone text,
  mayor_name text,
  latitude double precision,
  longitude double precision,
  location_label text,
  is_active boolean,
  approval_status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not private.has_role('admin') then
    raise exception 'Accès réservé aux administrateurs PCS';
  end if;

  return query
  select m.id, m.name, m.region_id, r.name, m.commune_id, c.name,
         m.account_user_id, m.phone, m.mayor_name, m.latitude, m.longitude,
         m.location_label, m.is_active, m.approval_status, m.created_at
  from public.mairies m
  join public.regions r on r.id = m.region_id
  join public.communes c on c.id = m.commune_id
  where m.approval_status = 'pending'
  order by m.created_at desc;
end;
$function$;

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
  if v_mairie.approval_status <> 'pending' then
    raise exception 'Cette demande mairie a déjà été traitée';
  end if;

  update public.mairies
  set approval_status = 'approved', is_active = true, updated_at = now()
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
  if v_mairie.approval_status <> 'pending' then
    raise exception 'Cette demande mairie a déjà été traitée';
  end if;

  update public.mairies
  set approval_status = 'rejected', is_active = false, updated_at = now()
  where id = p_mairie_id
  returning * into v_mairie;

  return v_mairie;
end;
$function$;

revoke all on function public.list_pending_mairie_requests() from public, anon, authenticated;
revoke all on function public.approve_mairie_request(uuid) from public, anon, authenticated;
revoke all on function public.reject_mairie_request(uuid) from public, anon, authenticated;
grant execute on function public.list_pending_mairie_requests() to authenticated;
grant execute on function public.approve_mairie_request(uuid) to authenticated;
grant execute on function public.reject_mairie_request(uuid) to authenticated;
