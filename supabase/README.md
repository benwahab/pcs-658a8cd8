# Supabase PCS

Projet Supabase dédié à PCS : `rqraxjypjwsxcmjdwroy`.

## Migrations versionnées

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
