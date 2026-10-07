-- Ensure a mairie's commune and region are the same administrative pair.
-- The target key must use the same column order as the foreign key.

alter table public.mairies
  drop constraint if exists mairies_commune_region_fk;

create unique index if not exists communes_id_region_uidx
  on public.communes(id, region_id);

alter table public.mairies
  add constraint mairies_commune_region_fk
  foreign key (commune_id, region_id)
  references public.communes(id, region_id);

alter table public.reports
  validate constraint reports_commune_region_fk;
