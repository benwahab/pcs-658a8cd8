-- PCS profile provisioning for new authenticated users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.categories(name,slug,description) values
 ('Voirie','voirie','Routes, nids-de-poule, trottoirs et circulation'),
 ('Déchets','dechets','Dépôts sauvages, collecte et salubrité'),
 ('Éclairage public','eclairage-public','Lampadaires et éclairage des espaces publics'),
 ('Eau et assainissement','eau-assainissement','Caniveaux, drainage et réseaux d’eau'),
 ('Environnement','environnement','Pollution, espaces verts et nuisances'),
 ('Équipements publics','equipements-publics','Bâtiments et équipements collectifs'),
 ('Sécurité et risques','securite-risques','Situations présentant un risque public'),
 ('Autre','autre','Autres problèmes d’intérêt public')
on conflict(slug) do update set name=excluded.name,description=excluded.description;

insert into public.departments(name,code,description) values
 ('Service Voirie','VOIRIE','Gestion et entretien de la voirie'),
 ('Service Propreté','PROPRETE','Gestion des déchets et de la salubrité'),
 ('Service Éclairage','ECLAIRAGE','Maintenance de l’éclairage public'),
 ('Service Eau et Assainissement','EAU-ASSAINISSEMENT','Eau, drainage et assainissement'),
 ('Service Environnement','ENVIRONNEMENT','Protection et entretien environnemental'),
 ('Service Équipements publics','EQUIPEMENTS','Gestion des équipements publics')
on conflict(code) do update set name=excluded.name,description=excluded.description;
