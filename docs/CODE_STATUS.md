# État du code PCS

## État actuel

Le dépôt officiel PCS est connecté à Lovable et la branche de travail suivie est `main`. Les commits poussés sur cette branche sont destinés à être resynchronisés dans Lovable.

Le projet utilise TanStack Start / React / TypeScript et le projet Supabase dédié `rqraxjypjwsxcmjdwroy`.

## Implémenté

- shell React/Vite et routage;
- authentification et gestion de session Supabase;
- rôles et garde d'accès;
- création réelle de signalements dans Supabase;
- catégories et communes depuis la base;
- géolocalisation navigateur;
- upload et accès contrôlé aux médias;
- détail d'un signalement, historique et médias signés;
- espace citoyen « Mes signalements »;
- traitement opérationnel et transitions de statut contrôlées;
- attribution et missions terrain;
- notifications persistantes côté base;
- RLS sur les données métier;
- helpers RLS SECURITY DEFINER isolés du schéma API public;
- protections serveur pour les opérations métier sensibles;
- PWA et mécanismes offline présents dans le code;
- CI GitHub Actions pour lint et build sur `main` et les pull requests.

## Vérifications / qualité

La CI automatise actuellement :

- installation des dépendances;
- lint;
- build de production.

Les tests unitaires, d'intégration, E2E et de sécurité automatisés restent à compléter. Aucun jeu de données fictif persistant ne doit être ajouté à Supabase pour réaliser ces tests.

## Points de sécurité à finaliser

- durcir le flux public de création d'une mairie avec une étape d'habilitation institutionnelle avant activation opérationnelle;
- ajouter une protection anti-abus robuste au flux public de connexion agent terrain;
- poursuivre la revue des fonctions SECURITY DEFINER et de leurs privilèges EXECUTE;
- tester les parcours d'autorisation citoyen / mairie / agent / organisation sur des comptes de test isolés.

## Migrations Supabase

Le dépôt contient une migration active sous `supabase/migrations/` et un historique de conception/évolution sous `supabase/migrations_source/`.

Cette situation doit encore être normalisée afin que le dépôt constitue une source de migrations reproductible et non ambiguë. Cette normalisation doit être réalisée sans rejouer aveuglément l'historique sur le projet Supabase existant et sans migration destructive.

## Avant mise en production publique

- compléter les tests automatisés;
- valider les parcours d'autorisation sur des comptes de test isolés;
- valider les flux offline sur appareils réels;
- finaliser la gouvernance d'habilitation des mairies;
- finaliser la protection anti-abus du login agent;
- vérifier l'état des migrations et leur reproductibilité;
- effectuer la validation UX/accessibilité sur appareils réels;
- configurer les secrets de déploiement;
- effectuer le déploiement production après validation finale.

## Règles de sécurité du dépôt

- ne jamais committer de clé Supabase secrète ou de service-role key;
- les fichiers `.env` locaux sont ignorés par Git; seul `.env.example` est versionné;
- le bucket `report-media` reste privé;
- les autorisations doivent être imposées côté serveur/RLS et pas uniquement dans l'interface;
- aucune donnée fictive persistante ne doit être ajoutée à la base de production;
- toute évolution de schéma doit passer par une migration versionnée ciblant uniquement le projet PCS.
