# Décisions d’architecture PCS

## ADR-001 — Supabase
**Statut:** proposé.
Supabase est retenu comme cible backend pour Auth, PostgreSQL, Storage, RLS et fonctions serveur lorsque nécessaires.

## ADR-002 — GitHub
**Statut:** adopté.
GitHub constitue la source de vérité du code et de la documentation.

## ADR-003 — Environnements séparés
**Statut:** proposé.
Development, staging et production doivent être séparés.

## ADR-004 — RLS
**Statut:** obligatoire.
Les permissions de données doivent être appliquées au niveau base de données et non uniquement dans l’interface.
