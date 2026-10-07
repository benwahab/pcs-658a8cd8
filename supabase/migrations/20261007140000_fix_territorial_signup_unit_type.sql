-- Territorial NIGELEC/NDE signup creates a local agency endpoint under the organization's central unit.
-- This preserves the existing one-central-unit invariant.

create or replace function public.approve_organization_signup_request(p_request_id uuid, p_note text default null)
returns public.organization_signup_requests
language plpgsql security definer
set search_path to 'public','private'
as $$
declare
  v_req public.organization_signup_requests;
  v_org public.organizations;
  v_parent_unit uuid;
  v_unit_id uuid;
  v_unit_code text;
  v_commune public.communes;
begin
  if not exists (select 1 from public.cst_accounts ca where ca.user_id = auth.uid()) then
    raise exception 'Seul le CST peut approuver une demande NIGELEC/NDE';
  end if;

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

  select id into v_parent_unit
    from public.organization_units
   where organization_id=v_req.organization_id
     and unit_type='central'
     and is_active=true
   limit 1;

  if v_parent_unit is null then
    raise exception 'L''organisation centrale NIGELEC/NDE doit être initialisée avant une unité locale';
  end if;

  if exists (
    select 1 from public.organization_units u
     where u.organization_id=v_req.organization_id
       and u.commune_id=v_req.commune_id
       and u.is_active=true
       and u.unit_type='agency'
  ) then
    raise exception 'Une unité locale active existe déjà pour cette organisation dans cette localité';
  end if;

  v_unit_code := upper(v_org.code || '-' || left(replace(v_req.commune_id::text,'-',''),8));

  insert into public.organization_units(
    organization_id,name,code,unit_type,parent_unit_id,region_id,commune_id,phone,email,is_active
  ) values (
    v_req.organization_id,trim(v_req.structure_name),v_unit_code,'agency',v_parent_unit,
    v_req.region_id,v_req.commune_id,nullif(trim(coalesce(v_req.phone,'')),''),v_req.email,true
  ) returning id into v_unit_id;

  insert into public.unit_communes(unit_id,commune_id)
  values(v_unit_id,v_req.commune_id)
  on conflict do nothing;

  insert into public.organization_users(user_id,organization_id,unit_id,role,is_active)
  values(v_req.user_id,v_req.organization_id,v_unit_id,'admin',true)
  on conflict (user_id,organization_id,unit_id)
  do update set is_active=true,role='admin',updated_at=now();

  update public.organization_signup_requests
     set status='approved',review_note=nullif(trim(coalesce(p_note,'')),''),
         reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
   where id=p_request_id returning * into v_req;

  return v_req;
end;
$$;

revoke execute on function public.approve_organization_signup_request(uuid,text) from public,anon;
grant execute on function public.approve_organization_signup_request(uuid,text) to authenticated;