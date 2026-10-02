# État du code PCS

## État actuel
Le dépôt officiel PCS est connecté à Lovable et la branche suivie est `main`. Les commits poussés sur cette branche sont destinés à être resynchronisés dans Lovable.

Le projet utilise TanStack Start / React / TypeScript et le projet Supabase dédié `rqraxjypjwsxcmjdwroy`.

## Fonctionnalités présentes
- Routage, shell React/Vite et interface PCS.
- Authentification Supabase, sessions, rôles et gardes d'accès.
- Création de signalements, catégories et communes depuis Supabase.
- Géolocalisation navigateur, médias et accès contrôlé aux fichiers.
- Détail des signalements, historique, espace citoyen et transitions de statut.
- Affectations, missions terrain et notifications persistantes.
- RLS sur les données métier, vues publiques et protections serveur.
- PWA et mécanismes hors connexion.
- GitHub Actions pour installation, typecheck, lint et build.

## Vérifications automatisées
La CI automatise l'installation, le contrôle TypeScript et le build de production. Le lint reste temporairement non bloquant pendant la normalisation du code historique.

Les tests unitaires, d'intégration, E2E et de sécurité restent à compléter. Les succès de compilation ne prouvent pas qu'un parcours métier fonctionne de bout en bout.

## Sécurité : changements et points ouverts
- La migration `20261002230000_redact_public_media_gps_and_restrict_trigger_function.sql` masque les coordonnées GPS dans la vue publique des médias, active `security_invoker` pour `public_reports` et retire les privilèges clients directs sur la fonction trigger d'archivage.
- Vérifier les droits effectifs des vues et les politiques RLS après chaque évolution.
- Maintenir le bucket `report-media` privé et vérifier que les URLs signées ne sont émises qu'après autorisation.
- Finaliser les protections anti-abus du login agent terrain et vérifier la confiance accordée aux en-têtes IP.
- Tester les autorisations citoyen / mairie / agent / organisation / CST avec des comptes isolés.
- Renforcer la gouvernance d'habilitation des mairies avant activation opérationnelle.
- Mettre en place la supervision et l'audit des actions sensibles.

## Migrations Supabase
Le dépôt contient un historique actif dans `supabase/migrations/` et des fichiers historiques/conception dans `supabase/migrations_source/`. Ne pas rejouer aveuglément les archives sur le projet existant.

Avant toute normalisation plus large :
1. comparer les migrations enregistrées dans Supabase aux fichiers Git;
2. identifier les divergences et les migrations historiques non reproductibles;
3. créer une procédure de reconstruction sur un projet de test isolé;
4. ne supprimer ou déplacer aucun fichier SQL historique avant validation.

## Hors connexion et médias
- Les opérations en attente doivent exposer les erreurs et permettre une reprise contrôlée.
- Tester la synchronisation sur appareils réels et connexions instables.
- Vérifier les limites de taille, les types MIME, la géolocalisation et la modération côté serveur.
- Le nettoyage des archives vidéo CST doit être planifié de manière sécurisée avant d'être automatisé; ne pas lancer de suppression destructive sans validation.

## Avant mise en production
- Ajouter des tests unitaires, intégration, E2E et sécurité.
- Valider les parcours sur appareils réels et petits écrans.
- Configurer et tester les sauvegardes et la restauration.
- Vérifier les secrets de déploiement, les journaux, la supervision et les alertes.
- Finaliser les contrôles de gouvernance et les parcours de connexion.
- Effectuer un audit de dépendances et rendre le lint bloquant après résolution des erreurs historiques.
- Déployer seulement après validation des tests critiques.

## Règles de sécurité du dépôt
- Ne jamais committer de clé Supabase secrète ou de service-role key.
- Les fichiers `.env` locaux sont ignorés par Git; seul `.env.example` est versionné.
- Les autorisations doivent être imposées côté serveur/RLS, pas uniquement dans l'interface.
- Ne pas ajouter de données fictives persistantes dans la base de production.
- Toute évolution du schéma passe par une migration versionnée et vérifiée sur le projet PCS.
