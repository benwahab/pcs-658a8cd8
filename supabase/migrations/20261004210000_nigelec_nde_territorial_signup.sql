-- Territorial registration for NIGELEC/NDE central units; additive and non-destructive.
alter table public.organization_signup_requests
  add column if not exists structure_name text,
  add column if not exists region_id uuid references public.regions(id) on delete restrict,
  add column if not exists commune_id uuid references public.communes(id) on delete restrict,
  add column if not exists phone text;

alter table public.organization_units
  add column if not exists commune_id uuid references public.communes(id) on delete restrict;

create unique index if not exists organization_signup_requests_org_commune_active_uidx
  on public.organization_signup_requests (organization_id, commune_id)
  where commune_id is not null and status in ('pending', 'approved');

create unique index if not exists organization_units_org_commune_central_uidx
  on public.organization_units (organization_id, commune_id)
  where commune_id is not null and unit_type = 'central' and is_active = true;

drop function if exists public.list_organization_signup_requests();
create function public.list_organization_signup_requests()
returns table(
  id uuid, user_id uuid, organization_id uuid, organization_name text, organization_code text,
  email text, full_name text, status text, review_note text, reviewed_by uuid,
  reviewed_at timestamptz, created_at timestamptz, structure_name text,
  region_id uuid, region_name text, commune_id uuid, commune_name text, phone text
)
language sql stable security definer
set search_path to 'public','private'
as $function$
  select r.id,r.user_id,r.organization_id,o.name,o.code,r.email,r.full_name,r.status,
         r.review_note,r.reviewed_by,r.reviewed_at,r.created_at,r.structure_name,
         r.region_id,reg.name,r.commune_id,c.name,r.phone
    from public.organization_signup_requests r
    join public.organizations o on o.id=r.organization_id
    left join public.regions reg on reg.id=r.region_id
    left join public.communes c on c.id=r.commune_id
   where private.has_role('admin')
   order by r.created_at desc;
$function$;

grant execute on function public.list_organization_signup_requests() to authenticated;

create or replace function public.approve_organization_signup_request(p_request_id uuid, p_note text default null)
returns public.organization_signup_requests
language plpgsql security definer
set search_path to 'public','private'
as $$
declare
  v_req public.organization_signup_requests;
  v_org public.organizations;
  v_unit_id uuid;
  v_unit_code text;
  v_commune public.communes;
begin
  if not private.has_role('admin') then raise exception 'Accès refusé'; end if;

  select * into v_req from public.organization_signup_requests where id=p_request_id for update;
  if not found then raise exception 'Demande introuvable'; end if;
  if v_req.status <> 'pending' then raise exception 'Cette demande a déjà été traitée'; end if;

  select * into v_org from public.organizations where id=v_req.organization_id and is_active=true;
  if not found or upper(v_org.code) not in ('NIGELEC','NDE') then
    raise exception 'Organisation NIGELEC/NDE invalide ou inactive';
  end if;
  if v_req.region_id is null or v_req.commune_id is null or nullif(trim(v_req.structure_name),'') is null then
    raise exception 'La structure, la région et la localité sont obligatoires';
  end if;

  select * into v_commune from public.communes
   where id=v_req.commune_id and region_id=v_req.region_id and is_active=true;
  if not found then raise exception 'La localité ne correspond pas à la région sélectionnée'; end if;

  if exists (
    select 1 from public.organization_units u
     where u.organization_id=v_req.organization_id and u.commune_id=v_req.commune_id
       and u.unit_type='central' and u.is_active=true
  ) then raise exception 'Un compte central de cette structure existe déjà pour cette localité'; end if;

  v_unit_code := upper(v_org.code || '-' || left(replace(v_req.commune_id::text,'-',''),8));
  insert into public.organization_units(
    organization_id,name,code,unit_type,parent_unit_id,region_id,commune_id,phone,email,is_active
  ) values (
    v_req.organization_id,trim(v_req.structure_name),v_unit_code,'central',null,
    v_req.region_id,v_req.commune_id,nullif(trim(coalesce(v_req.phone,'')),''),v_req.email,true
  ) returning id into v_unit_id;

  insert into public.organization_users(user_id,organization_id,unit_id,role,is_active)
  values(v_req.user_id,v_req.organization_id,v_unit_id,'admin',true)
  on conflict (user_id,organization_id,unit_id)
  do update set is_active=true,role='admin',updated_at=now();

  update public.organization_signup_requests
     set status='approved',review_note=nullif(trim(coalesce(p_note,'')),''),reviewed_by=auth.uid(),
         reviewed_at=now(),updated_at=now()
   where id=p_request_id returning * into v_req;
  return v_req;
end;
$$;
