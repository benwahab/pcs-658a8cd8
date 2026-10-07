# Brief d’intégration Lovable

## Source de vérité
Le dépôt GitHub PCS contient le cahier des charges et les contraintes techniques.

## Instruction principale
Construire sur l’existant sans supprimer les règles métier, la sécurité, les rôles ou la structure Supabase validée.

## À ne pas faire
- inventer des données réelles;
- connecter un autre projet Supabase par défaut;
- exposer de secrets;
- contourner RLS;
- remplacer une fonctionnalité backend par une simple simulation frontend.

## Première configuration
1. connecter GitHub `benwahab/PCS`;
2. créer/identifier le projet Supabase PCS dédié;
3. configurer les variables d’environnement;
4. vérifier les migrations;
5. lancer les tests;
6. poursuivre le développement par modules.
