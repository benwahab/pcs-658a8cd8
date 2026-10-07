-- PCS: fondation multi-organisations
-- 0021_multi_organization_foundation
-- Ajoute le modèle organisationnel sans modifier le workflow mairie/agent existant.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  type text not null default 'public_service'
    check (type in ('public_service','utility','municipal','other')),
  description text,
  logo_url text,
  email text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_code_unique unique (code)
);

create table if not exists public.organization_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  code text not null,
  unit_type text not null check (unit_type in ('central','agency')),
  parent_unit_id uuid references public.organization_units(id) on delete restrict,
  description text,
  region_id uuid references public.regions(id) on delete restrict,
  latitude double precision,
  longitude double precision,
  location_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_units_code_unique unique (organization_id, code),
  constraint organization_units_parent_check check (
    (unit_type = 'central' and parent_unit_id is null)
    or
    (unit_type = 'agency' and parent_unit_id is not null)
  )
);

create unique index if not exists organization_one_central_unit_uidx
  on public.organization_units(organization_id)
  where unit_type = 'central';

create table if not exists public.organization_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid references public.organization_units(id) on delete cascade,
  role text not null check (role in ('admin','supervisor','operator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_users_unique_membership unique (user_id, organization_id, unit_id)
);

create index if not exists organization_users_user_idx
  on public.organization_users(user_id);

create index if not exists organization_users_org_unit_idx
  on public.organization_users(organization_id, unit_id);

create table if not exists public.unit_communes (
  unit_id uuid not null references public.organization_units(id) on delete cascade,
  commune_id uuid not null references public.communes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (unit_id, commune_id)
);

create index if not exists unit_communes_commune_idx
  on public.unit_communes(commune_id);

create table if not exists public.report_organization_transfers (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  from_mairie_id uuid not null references public.mairies(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled','completed')),
  transmitted_by uuid not null references auth.users(id) on delete restrict,
  transmitted_at timestamptz not null default now(),
  responded_by uuid references auth.users(id) on delete restrict,
  responded_at timestamptz,
  response_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists report_org_transfers_report_idx
  on public.report_organization_transfers(report_id);

create index if not exists report_org_transfers_org_status_idx
  on public.report_organization_transfers(organization_id, status);

create unique index if not exists report_one_pending_org_transfer_uidx
  on public.report_organization_transfers(report_id)
  where status = 'pending';

create table if not exists public.report_unit_assignments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  unit_id uuid not null references public.organization_units(id) on delete restrict,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  status text not null default 'assigned'
    check (status in ('assigned','accepted','declined','in_progress','completed','cancelled')),
  mission_note text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists report_unit_assignments_report_idx
  on public.report_unit_assignments(report_id);

create index if not exists report_unit_assignments_unit_status_idx
  on public.report_unit_assignments(unit_id, status);

create unique index if not exists report_one_active_unit_assignment_uidx
  on public.report_unit_assignments(report_id)
  where unassigned_at is null;

alter table public.field_agents
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

alter table public.field_agents
  add column if not exists organization_unit_id uuid references public.organization_units(id) on delete restrict;

create index if not exists field_agents_org_unit_idx
  on public.field_agents(organization_id, organization_unit_id);

insert into public.organizations (name, code, type, description)
values
  ('NIGELEC', 'NIGELEC', 'utility', 'Société nigérienne d’électricité'),
  ('NDE', 'NDE', 'utility', 'Nigérienne des eaux')
on conflict (code) do nothing;

insert into public.organization_units (organization_id, name, code, unit_type)
select id, name || ' Central', code || '_CENTRAL', 'central'
from public.organizations
where code in ('NIGELEC','NDE')
on conflict (organization_id, code) do nothing;

alter table public.organizations enable row level security;
alter table public.organization_units enable row level security;
alter table public.organization_users enable row level security;
alter table public.unit_communes enable row level security;
alter table public.report_organization_transfers enable row level security;
alter table public.report_unit_assignments enable row level security;

create policy organizations_staff_read
  on public.organizations for select to authenticated
  using (private.is_staff());

create policy organization_units_staff_read
  on public.organization_units for select to authenticated
  using (private.is_staff());

create policy organization_users_staff_read
  on public.organization_users for select to authenticated
  using (private.is_staff());

create policy unit_communes_staff_read
  on public.unit_communes for select to authenticated
  using (private.is_staff());

create policy report_org_transfers_staff_all
  on public.report_organization_transfers for all to authenticated
  using (private.is_staff())
  with check (private.is_staff());

create policy report_unit_assignments_staff_all
  on public.report_unit_assignments for all to authenticated
  using (private.is_staff())
  with check (private.is_staff());
