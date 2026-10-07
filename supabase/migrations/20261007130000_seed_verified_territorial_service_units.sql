-- Seed only service localities supported by authoritative public sources.
-- A unit is a routing endpoint, not a claim that every commune has a physical branch.
-- NIGELEC: current public agency directory.
-- NDE: MHA/E 2019-2023 public statistics, Table 51 (centres).

create temporary table if not exists tmp_pcs_service_targets(
  organization_code text,
  unit_name text,
  unit_code text,
  commune_names text[]
) on commit drop;

truncate tmp_pcs_service_targets;

insert into tmp_pcs_service_targets values
('NIGELEC','NIGELEC — VILLE DE NIAMEY','NIGELEC-NIAMEY',array['VILLE DE NIAMEY']),
('NIGELEC','NIGELEC — TILLABERI','NIGELEC-TILLABERI',array['TILLABERI']),
('NIGELEC','NIGELEC — FILINGUE','NIGELEC-FILINGUE',array['FILINGUE']),
('NIGELEC','NIGELEC — KOLLO','NIGELEC-KOLLO',array['KOLLO']),
('NIGELEC','NIGELEC — SAY','NIGELEC-SAY',array['SAY']),
('NIGELEC','NIGELEC — OUALLAM','NIGELEC-OUALLAM',array['OUALLAM']),
('NIGELEC','NIGELEC — TERA','NIGELEC-TERA',array['TERA']),
('NIGELEC','NIGELEC — GOTHEYE','NIGELEC-GOTHEYE',array['GOTHEYE']),
('NIGELEC','NIGELEC — BALLEYARA','NIGELEC-BALLEYARA',array['BALLEYARA']),
('NIGELEC','NIGELEC — DOSSO','NIGELEC-DOSSO',array['DOSSO']),
('NIGELEC','NIGELEC — DOUTCHI','NIGELEC-DOUTCHI',array['DOGON DOUTCHI']),
('NIGELEC','NIGELEC — GAYA','NIGELEC-GAYA',array['GAYA']),
('NIGELEC','NIGELEC — BIRNI N''GAOURE','NIGELEC-BIRNI-NGAOURE',array['BIRNI N''GAOURE']),
('NIGELEC','NIGELEC — LOGA','NIGELEC-LOGA',array['LOGA']),
('NIGELEC','NIGELEC — TIBIRI (DOUTCHI)','NIGELEC-TIBIRI-DOUTCHI',array['TIBIRI (DOUTCHI)']),
('NIGELEC','NIGELEC — KIOTA','NIGELEC-KIOTA',array['KIOTA']),
('NIGELEC','NIGELEC — MARADI','NIGELEC-MARADI',array['MARADI ARRONDISSEMENT 1','MARADI ARRONDISSEMENT 2','MARADI ARRONDISSEMENT 3']),
('NIGELEC','NIGELEC — TESSAOUA','NIGELEC-TESSAOUA',array['TESSAOUA']),
('NIGELEC','NIGELEC — AGUIE','NIGELEC-AGUIE',array['AGUIE']),
('NIGELEC','NIGELEC — MADAROUNFA','NIGELEC-MADAROUNFA',array['MADAROUNFA']),
('NIGELEC','NIGELEC — MAYAHI','NIGELEC-MAYAHI',array['MAYAHI']),
('NIGELEC','NIGELEC — DAKORO','NIGELEC-DAKORO',array['DAKORO']),
('NIGELEC','NIGELEC — GUIDAN ROUMDJI','NIGELEC-GUIDAN-ROUMDJI',array['GUIDAN ROUMDJI']),
('NIGELEC','NIGELEC — TIBIRI (MARADI)','NIGELEC-TIBIRI-MARADI',array['TIBIRI (MARADI)']),
('NIGELEC','NIGELEC — TCHADOUA','NIGELEC-TCHADOUA',array['TCHADOUA']),
('NIGELEC','NIGELEC — TAHOUA','NIGELEC-TAHOUA',array['TAHOUA']),
('NIGELEC','NIGELEC — BIRNI N''KONNI','NIGELEC-BIRNI-KONNI',array['BIRNI N''KONNI']),
('NIGELEC','NIGELEC — MALBAZA','NIGELEC-MALBAZA',array['MALBAZA']),
('NIGELEC','NIGELEC — MADAOUA','NIGELEC-MADAOUA',array['MADAOUA']),
('NIGELEC','NIGELEC — ILLELA','NIGELEC-ILLELA',array['ILLELA']),
('NIGELEC','NIGELEC — KEITA','NIGELEC-KEITA',array['KEITA']),
('NIGELEC','NIGELEC — BOUZA','NIGELEC-BOUZA',array['BOUZA']),
('NIGELEC','NIGELEC — TCHINTABARADEN','NIGELEC-TCHINTABARADEN',array['TCHINTABARADEN']),
('NIGELEC','NIGELEC — ABALAK','NIGELEC-ABALAK',array['ABALAK']),
('NIGELEC','NIGELEC — BADAGUICHIRI','NIGELEC-BADAGUICHIRI',array['BADAGUICHIRI']),
('NIGELEC','NIGELEC — ZINDER','NIGELEC-ZINDER',array['ZINDER ARRONDISSEMENT 1','ZINDER ARRONDISSEMENT 2','ZINDER ARRONDISSEMENT 3','ZINDER ARRONDISSEMENT 4','ZINDER ARRONDISSEMENT 5']),
('NIGELEC','NIGELEC — MAGARIA','NIGELEC-MAGARIA',array['MAGARIA']),
('NIGELEC','NIGELEC — MIRRIAH','NIGELEC-MIRRIAH',array['MIRRIAH']),
('NIGELEC','NIGELEC — MATAMEY','NIGELEC-MATAMEY',array['MATAMEY']),
('NIGELEC','NIGELEC — TANOUT','NIGELEC-TANOUT',array['TANOUT']),
('NIGELEC','NIGELEC — GOURE','NIGELEC-GOURE',array['GOURE']),
('NIGELEC','NIGELEC — DIFFA','NIGELEC-DIFFA',array['DIFFA']),
('NIGELEC','NIGELEC — MAINE SOROA','NIGELEC-MAINE-SOROA',array['MAINE SOROA']),
('NIGELEC','NIGELEC — N''GUIGMI','NIGELEC-N-GUIGMI',array['N''GUIGMI']),
('NIGELEC','NIGELEC — BOSSO','NIGELEC-BOSSO',array['BOSSO']),
('NIGELEC','NIGELEC — AGADEZ','NIGELEC-AGADEZ',array['AGADEZ']),
('NIGELEC','NIGELEC — ARLIT','NIGELEC-ARLIT',array['ARLIT']),
('NIGELEC','NIGELEC — BILMA','NIGELEC-BILMA',array['BILMA']),
('NIGELEC','NIGELEC — DIRKOU','NIGELEC-DIRKOU',array['DIRKOU']),
('NIGELEC','NIGELEC — TCHIROZERINE','NIGELEC-TCHIROZERINE',array['TCHIROZERINE']),
('NDE','NDE — AGADEZ','NDE-AGADEZ',array['AGADEZ']),
('NDE','NDE — INGALL','NDE-INGALL',array['INGALL']),
('NDE','NDE — ARLIT','NDE-ARLIT',array['ARLIT']),
('NDE','NDE — DIFFA','NDE-DIFFA',array['DIFFA']),
('NDE','NDE — N''GUIGMI','NDE-N-GUIGMI',array['N''GUIGMI']),
('NDE','NDE — MAINE SOROA','NDE-MAINE-SOROA',array['MAINE SOROA']),
('NDE','NDE — GOUDOUMARIA','NDE-GOUDOUMARIA',array['GOUDOUMARIA']),
('NDE','NDE — DOSSO','NDE-DOSSO',array['DOSSO']),
('NDE','NDE — DOUTCHI','NDE-DOUTCHI',array['DOGON DOUTCHI']),
('NDE','NDE — GAYA','NDE-GAYA',array['GAYA']),
('NDE','NDE — LOGA','NDE-LOGA',array['LOGA']),
('NDE','NDE — DIOUNDIOU','NDE-DIOUNDIOU',array['DIOUNDIOU']),
('NDE','NDE — MATANKARI','NDE-MATANKARI',array['MATANKARI']),
('NDE','NDE — BIRNI N''GAOURE','NDE-BIRNI-NGAOURE',array['BIRNI N''GAOURE']),
('NDE','NDE — MARADI','NDE-MARADI',array['MARADI ARRONDISSEMENT 1','MARADI ARRONDISSEMENT 2','MARADI ARRONDISSEMENT 3']),
('NDE','NDE — TESSAOUA','NDE-TESSAOUA',array['TESSAOUA']),
('NDE','NDE — DAKORO','NDE-DAKORO',array['DAKORO']),
('NDE','NDE — MAYAHI','NDE-MAYAHI',array['MAYAHI']),
('NDE','NDE — GAZAOUA','NDE-GAZAOUA',array['GAZAOUA']),
('NDE','NDE — MADAROUNFA','NDE-MADAROUNFA',array['MADAROUNFA']),
('NDE','NDE — AGUIE','NDE-AGUIE',array['AGUIE']),
('NDE','NDE — GUIDAN ROUMDJI','NDE-GUIDAN-ROUMDJI',array['GUIDAN ROUMDJI']),
('NDE','NDE — TIBIRI','NDE-TIBIRI',array['TIBIRI (MARADI)']),
('NDE','NDE — DAN ISSA','NDE-DAN-ISSA',array['DAN-ISSA']),
('NDE','NDE — TAHOUA','NDE-TAHOUA',array['TAHOUA']),
('NDE','NDE — KONNI','NDE-KONNI',array['BIRNI N''KONNI']),
('NDE','NDE — MADAOUA','NDE-MADAOUA',array['MADAOUA']),
('NDE','NDE — TCHINTA','NDE-TCHINTA',array['TCHINTABARADEN']),
('NDE','NDE — ABALAK','NDE-ABALAK',array['ABALAK']),
('NDE','NDE — KEITA','NDE-KEITA',array['KEITA']),
('NDE','NDE — BOUZA','NDE-BOUZA',array['BOUZA']),
('NDE','NDE — ILLELA','NDE-ILLELA',array['ILLELA']),
('NDE','NDE — TAMASKE','NDE-TAMASKE',array['TAMASKE']),
('NDE','NDE — TASSARA','NDE-TASSARA',array['TASSARA']),
('NDE','NDE — DOGUERAOUA','NDE-DOGUERAOUA',array['DOGUERAWA']),
('NDE','NDE — TILLIA','NDE-TILLIA',array['TILLIA']),
('NDE','NDE — IBOHAMANE','NDE-IBOHAMANE',array['IBOHAMANE']),
('NDE','NDE — BAGAROUA','NDE-BAGAROUA',array['BAGAROUA']),
('NDE','NDE — TAKANAMAT','NDE-TAKANAMAT',array['TAKANAMAT']),
('NDE','NDE — TILLABERI','NDE-TILLABERI',array['TILLABERI']),
('NDE','NDE — FILINGUE','NDE-FILINGUE',array['FILINGUE']),
('NDE','NDE — TERA','NDE-TERA',array['TERA']),
('NDE','NDE — KOLLO','NDE-KOLLO',array['KOLLO']),
('NDE','NDE — OUALLAM','NDE-OUALLAM',array['OUALLAM']),
('NDE','NDE — SAY','NDE-SAY',array['SAY']),
('NDE','NDE — TORODI','NDE-TORODI',array['TORODI']),
('NDE','NDE — GOTHEYE','NDE-GOTHEYE',array['GOTHEYE']),
('NDE','NDE — FALMEY','NDE-FALMEY',array['FALMEY']),
('NDE','NDE — VILLE DE NIAMEY','NDE-NIAMEY',array['VILLE DE NIAMEY']),
('NDE','NDE — ZINDER','NDE-ZINDER',array['ZINDER ARRONDISSEMENT 1','ZINDER ARRONDISSEMENT 2','ZINDER ARRONDISSEMENT 3','ZINDER ARRONDISSEMENT 4','ZINDER ARRONDISSEMENT 5']),
('NDE','NDE — MAGARIA','NDE-MAGARIA',array['MAGARIA']),
('NDE','NDE — MIRRIAH','NDE-MIRRIAH',array['MIRRIAH']),
('NDE','NDE — TANOUT','NDE-TANOUT',array['TANOUT']),
('NDE','NDE — MATAMEYE','NDE-MATAMEYE',array['MATAMEY']),
('NDE','NDE — GOURE','NDE-GOURE',array['GOURE']);

do $$
declare r record; v_org uuid; v_unit uuid; v_first_commune uuid;
begin
  for r in select * from tmp_pcs_service_targets loop
    select id into v_org from public.organizations where upper(code)=r.organization_code and is_active=true limit 1;
    if v_org is null then continue; end if;

    select u.id into v_unit
      from public.organization_units u
     where u.organization_id=v_org and u.code=r.unit_code
     limit 1;

    if v_unit is null then
      select c.id into v_first_commune
        from public.communes c
       where upper(c.name)=any(select upper(x) from unnest(r.commune_names) x)
       order by c.name limit 1;

      insert into public.organization_units(
        organization_id,name,code,unit_type,parent_unit_id,region_id,commune_id,is_active
      )
      select v_org,r.unit_name,r.unit_code,'agency',cu.id,c.region_id,null,true
        from public.communes c
        join public.organization_units cu
          on cu.organization_id=v_org and cu.unit_type='central' and cu.is_active=true
       where c.id=v_first_commune
      returning id into v_unit;
    end if;

    if v_unit is not null then
      insert into public.unit_communes(unit_id,commune_id)
      select v_unit,c.id
        from public.communes c
       where upper(c.name)=any(select upper(x) from unnest(r.commune_names) x)
         and c.is_active=true
      on conflict do nothing;
    end if;
  end loop;
end $$;

drop function if exists public.list_mairie_transmission_targets();

create or replace function public.list_mairie_transmission_targets()
returns table(
  organization_id uuid, organization_name text, organization_code text, organization_type text,
  organization_unit_id uuid, organization_unit_name text, organization_unit_code text,
  organization_unit_type text, commune_id uuid, commune_name text
)
language sql stable security definer
set search_path=''
as $function$
  select distinct o.id,o.name,o.code,o.type,u.id,u.name,u.code,u.unit_type,c.id,c.name
    from public.mairies m
    join public.unit_communes uc on uc.commune_id=m.commune_id
    join public.organization_units u on u.id=uc.unit_id and u.is_active=true
    join public.organizations o on o.id=u.organization_id and o.is_active=true
   and upper(o.code) in ('NIGELEC','NDE')
    join public.communes c on c.id=m.commune_id and c.is_active=true
   where m.account_user_id=(select auth.uid()) and m.is_active=true
   order by case upper(o.code) when 'NIGELEC' then 1 when 'NDE' then 2 else 9 end,u.name;
$function$;

revoke execute on function public.list_mairie_transmission_targets() from public,anon;
grant execute on function public.list_mairie_transmission_targets() to authenticated;

create or replace function public.mairie_transmit_report(
  p_report_id uuid,p_organization_id uuid,p_organization_unit_id uuid,p_note text default null
)
returns uuid
language plpgsql security definer
set search_path=''
as $function$
declare v_transfer_id uuid; v_mairie_id uuid; v_mairie_commune_id uuid; v_reference text;
begin
  if (select auth.uid()) is null then raise exception 'Session requise.'; end if;

  select m.id,m.commune_id,r.reference_code into v_mairie_id,v_mairie_commune_id,v_reference
    from public.mairies m join public.reports r on r.commune_id=m.commune_id
   where r.id=p_report_id and m.account_user_id=(select auth.uid()) and m.is_active=true
   for update of r;

  if v_mairie_id is null then raise exception 'La mairie ne peut transmettre que ses signalements communaux'; end if;

  if not exists(
    select 1
      from public.unit_communes uc
      join public.organization_units u on u.id=uc.unit_id
      join public.organizations o on o.id=u.organization_id
     where u.id=p_organization_unit_id
       and u.organization_id=p_organization_id
       and uc.commune_id=v_mairie_commune_id
       and u.is_active=true
       and o.is_active=true
       and upper(o.code) in ('NIGELEC','NDE')
  ) then
    raise exception 'La mairie ne peut transmettre qu''à NIGELEC ou NDE de sa propre localité';
  end if;

  if exists(select 1 from public.report_organization_transfers where report_id=p_report_id and status='pending') then
    raise exception 'Une transmission est déjà en attente pour ce signalement';
  end if;

  insert into public.report_organization_transfers(report_id,organization_id,organization_unit_id,from_mairie_id,transmitted_by,response_note)
  values(p_report_id,p_organization_id,p_organization_unit_id,v_mairie_id,(select auth.uid()),nullif(trim(coalesce(p_note,'')),''))
  returning id into v_transfer_id;

  insert into public.notifications(user_id,report_id,type,title,body)
  select distinct ou.user_id,p_report_id,'organization_transfer','Nouveau signalement transmis',
         'Le signalement '||coalesce(v_reference,p_report_id::text)||' a été transmis à '||o.name||' pour la localité de la mairie.'
    from public.organization_users ou
    join public.organizations o on o.id=p_organization_id
   where ou.organization_id=p_organization_id and ou.unit_id is null and ou.is_active
     and ou.role in ('admin','supervisor');

  return v_transfer_id;
end;
$function$;

revoke execute on function public.mairie_transmit_report(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.mairie_transmit_report(uuid,uuid,uuid,text) to authenticated;