-- PCS: organization account request and admin habilitation workflow.
-- No fictitious application data is created.

create table if not exists public.organization_signup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  email text not null,
  full_name text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_signup_requests_status_idx
  on public.organization_signup_requests(status, created_at desc);

create unique index if not exists organization_signup_requests_pending_user_org_idx
  on public.organization_signup_requests(user_id, organization_id)
  where status='pending';

alter table public.organization_signup_requests enable row level security;
revoke all on public.organization_signup_requests from public, anon, authenticated;
grant select on public.organization_signup_requests to authenticated;

drop policy if exists organization_signup_requests_admin_read on public.organization_signup_requests;
create policy organization_signup_requests_admin_read
on public.organization_signup_requests for select to authenticated
using (private.has_role('admin'));

create or replace function public.create_organization_signup_request_from_auth()
returns trigger language plpgsql security definer set search_path=public as $function$
declare v_code text; v_org_id uuid; v_name text;
begin
  v_code:=upper(coalesce(new.raw_user_meta_data->>'requested_organization',''));
  if v_code not in ('NIGELEC','NDE') then return new; end if;
  select id into v_org_id from public.organizations
   where code=v_code and type='utility' and is_active=true limit 1;
  if v_org_id is null then return new; end if;
  v_name:=left(trim(coalesce(new.raw_user_meta_data->>'full_name','')),200);
  if v_name='' then v_name:=left(coalesce(new.email,'Compte professionnel'),200); end if;
  insert into public.organization_signup_requests(user_id,organization_id,email,full_name)
  values(new.id,v_org_id,lower(coalesce(new.email,'')),v_name)
  on conflict do nothing;
  return new;
end;
$function$;

drop trigger if exists trg_create_organization_signup_request on auth.users;
create trigger trg_create_organization_signup_request
after insert on auth.users for each row execute function public.create_organization_signup_request_from_auth();

create or replace function public.list_organization_signup_requests()
returns table(id uuid,user_id uuid,organization_id uuid,organization_name text,organization_code text,email text,full_name text,status text,review_note text,reviewed_by uuid,reviewed_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path=public,private as $function$
select r.id,r.user_id,r.organization_id,o.name,o.code,r.email,r.full_name,r.status,r.review_note,r.reviewed_by,r.reviewed_at,r.created_at
from public.organization_signup_requests r join public.organizations o on o.id=r.organization_id
where private.has_role('admin') order by r.created_at desc;
$function$;
revoke all on function public.list_organization_signup_requests() from public,anon,authenticated;
grant execute on function public.list_organization_signup_requests() to authenticated;

create or replace function public.approve_organization_signup_request(p_request_id uuid,p_note text default null)
returns public.organization_signup_requests language plpgsql security definer set search_path=public,private as $function$
declare v_req public.organization_signup_requests; v_unit_id uuid;
begin
 if not private.has_role('admin') then raise exception 'Accès refusé'; end if;
 select * into v_req from public.organization_signup_requests where id=p_request_id for update;
 if not found then raise exception 'Demande introuvable'; end if;
 if v_req.status<>'pending' then raise exception 'Cette demande a déjà été traitée'; end if;
 select id into v_unit_id from public.organization_units where organization_id=v_req.organization_id and unit_type='central' and is_active=true order by created_at limit 1;
 if v_unit_id is null then raise exception 'Unité centrale de l’organisation introuvable'; end if;
 insert into public.organization_users(user_id,organization_id,unit_id,role,is_active)
 values(v_req.user_id,v_req.organization_id,v_unit_id,'admin',true)
 on conflict(user_id,organization_id,unit_id) do update set is_active=true,role='admin',updated_at=now();
 update public.organization_signup_requests set status='approved',review_note=nullif(trim(coalesce(p_note,'')),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
 where id=p_request_id returning * into v_req;
 return v_req;
end;
$function$;
revoke all on function public.approve_organization_signup_request(uuid,text) from public,anon;
grant execute on function public.approve_organization_signup_request(uuid,text) to authenticated;

create or replace function public.reject_organization_signup_request(p_request_id uuid,p_note text)
returns public.organization_signup_requests language plpgsql security definer set search_path=public,private as $function$
declare v_req public.organization_signup_requests;
begin
 if not private.has_role('admin') then raise exception 'Accès refusé'; end if;
 if nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'Un motif est obligatoire'; end if;
 select * into v_req from public.organization_signup_requests where id=p_request_id for update;
 if not found then raise exception 'Demande introuvable'; end if;
 if v_req.status<>'pending' then raise exception 'Cette demande a déjà été traitée'; end if;
 update public.organization_signup_requests set status='rejected',review_note=left(trim(p_note),1000),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
 where id=p_request_id returning * into v_req;
 return v_req;
end;
$function$;
revoke all on function public.reject_organization_signup_request(uuid,text) from public,anon;
grant execute on function public.reject_organization_signup_request(uuid,text) to authenticated;
