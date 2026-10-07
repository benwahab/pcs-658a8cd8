-- Verified major service hubs only. Local service coverage must be expanded from confirmed organizational data;
-- never inferred from the existence of a commune.
create temporary table tmp_targets(code text,name text,unit_code text,commune_name text) on commit drop;
insert into tmp_targets values
('NIGELEC','NIGELEC — VILLE DE NIAMEY','NIGELEC-NIAMEY','VILLE DE NIAMEY'),
('NIGELEC','NIGELEC — DOSSO','NIGELEC-DOSSO','DOSSO'),
('NIGELEC','NIGELEC — MARADI','NIGELEC-MARADI','MARADI ARRONDISSEMENT 1'),
('NIGELEC','NIGELEC — TAHOUA','NIGELEC-TAHOUA','TAHOUA ARRONDISSEMENT 1'),
('NIGELEC','NIGELEC — AGADEZ','NIGELEC-AGADEZ','AGADEZ'),
('NIGELEC','NIGELEC — TILLABERI','NIGELEC-TILLABERI','TILLABERI'),
('NIGELEC','NIGELEC — ZINDER','NIGELEC-ZINDER','ZINDER ARRONDISSEMENT 1'),
('NIGELEC','NIGELEC — DIFFA','NIGELEC-DIFFA','DIFFA'),
('NDE','NDE — VILLE DE NIAMEY','NDE-NIAMEY','VILLE DE NIAMEY'),
('NDE','NDE — DOSSO','NDE-DOSSO','DOSSO'),
('NDE','NDE — MARADI','NDE-MARADI','MARADI ARRONDISSEMENT 1'),
('NDE','NDE — TAHOUA','NDE-TAHOUA','TAHOUA ARRONDISSEMENT 1'),
('NDE','NDE — AGADEZ','NDE-AGADEZ','AGADEZ'),
('NDE','NDE — TILLABERI','NDE-TILLABERI','TILLABERI'),
('NDE','NDE — ZINDER','NDE-ZINDER','ZINDER ARRONDISSEMENT 1'),
('NDE','NDE — DIFFA','NDE-DIFFA','DIFFA');

do $$ declare r record; o uuid; p uuid; u uuid; c uuid;
begin
 for r in select * from tmp_targets loop
  select id into o from public.organizations where upper(code)=r.code and is_active limit 1;
  select id into p from public.organization_units where organization_id=o and unit_type='central' and is_active limit 1;
  select id into c from public.communes where upper(name)=upper(r.commune_name) and is_active limit 1;
  if o is null or p is null or c is null then continue; end if;
  select id into u from public.organization_units where organization_id=o and code=r.unit_code limit 1;
  if u is null then
   insert into public.organization_units(organization_id,name,code,unit_type,parent_unit_id,region_id,commune_id,is_active)
   values(o,r.name,r.unit_code,'agency',p,(select region_id from public.communes where id=c),c,true)
   returning id into u;
  end if;
  insert into public.unit_communes(unit_id,commune_id) values(u,c) on conflict do nothing;
 end loop;
end $$;