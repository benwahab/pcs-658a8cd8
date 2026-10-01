# Supabase PCS

Projet Supabase dédié à PCS : `rqraxjypjwsxcmjdwroy`.

## Migrations versionnées (liste historique, incomplète)

- 0001_initial_schema.sql — schéma métier
- 0002_security.sql — RLS et rôles
- 0003_profile_and_seed.sql — profil, catégories et services
- 0004_storage.sql — bucket privé des médias
- 0005_status_history.sql — historique et notifications
- 0006_workflow_and_role.sql — rôle citoyen automatique et transitions de statut
- 0007_private_rls_helpers.sql — helpers RLS SECURITY DEFINER hors schéma API public

## Règles de production

- Ne jamais exécuter ces migrations sur un autre produit.
- Ne jamais committer de clé Supabase secrète.
- Le frontend utilise uniquement l’URL du projet et la publishable key.
- Les autorisations sont imposées par RLS, pas seulement par l’interface.
- Le bucket `report-media` reste privé.
- Aucun faux signalement ou jeu de données de démonstration n’est requis pour le fonctionnement.
- Toute nouvelle modification du schéma doit être ajoutée comme migration versionnée et appliquée au seul projet PCS.

## État connu des migrations et des fonctions (audit du 1er octobre 2026)

À traiter avec accès au projet Supabase, sans rejouer l'historique ni migration destructive :

- `migrations/` contient les migrations actives (du 28/09/2026 au 01/10/2026). `migrations_source/` est l'historique de conception : ne pas l'exécuter tel quel (numéros en double `0002`/`0003`, `0024` et `0025` absents).
- Deux migrations actives portent le même horodatage `20261001100000` (`citizen_report_rate_limit` et `organization_signup_workflow`). Ne pas les renommer si elles sont déjà enregistrées dans l'historique Supabase ; vérifier d'abord `supabase_migrations.schema_migrations`.
- Les fonctions SQL `list_pending_mairie_requests`, `approve_mairie_request` et `reject_mairie_request` existent dans la base (elles figurent dans les types générés) mais dans aucune migration du dépôt : exporter leur définition et la versionner.
- Le front appelle `agency-create-agent` (`src/pcs/services/organization.ts`) alors qu'aucune source n'existe dans `edge-functions-source/` : vérifier si cette fonction est déployée.
- Les sources de `edge-functions-source/` ne se déploient pas automatiquement : après modification, redéployer chaque fonction manuellement.
- `config.toml` ne déclare `verify_jwt` que pour `cst-auth` et `cst-media-moderation` : déclarer explicitement les autres après comparaison avec le déploiement réel.
