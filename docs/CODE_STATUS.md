# État du code

## Implémenté

- shell React/Vite et routage;
- authentification Supabase OTP et gestion de session;
- rôles citizen/agent/moderator/admin avec navigation et garde de routes;
- création réelle de signalements dans Supabase;
- catégories réelles depuis la base;
- géolocalisation navigateur;
- upload réel de photos JPG/PNG/WebP dans le bucket privé;
- nettoyage d’un upload si l’insertion de métadonnées échoue;
- détail d’un signalement avec historique et médias signés;
- espace citoyen « Mes signalements »;
- traitement opérationnel avec priorités et transitions de statut contrôlées;
- calcul automatique de resolved_at;
- attribution de département via service backend;
- notifications persistantes côté base;
- RLS sur les données métier;
- helpers RLS SECURITY DEFINER déplacés dans un schéma privé non exposé;
- rôle citoyen attribué automatiquement à la création d’un compte;
- CI GitHub Actions pour installer et compiler l’application;
- documentation d’architecture, sécurité, gouvernance et déploiement.

## Vérifications backend effectuées

- projet Supabase PCS dédié : 'rqraxjypjwsxcmjdwroy';
- aucune donnée fictive de signalement;
- profils/signalements/médias : 0/0/0 au moment du contrôle;
- audit de sécurité Supabase : aucune alerte après déplacement des helpers RLS.

## Reste avant mise en production publique

- exécuter la CI et corriger toute erreur de compilation éventuelle;
- tests automatisés unitaires/intégration/E2E;
- pagination et recherche avancée à mesure que le volume augmente;
- observabilité et gestion centralisée des erreurs;
- configuration des secrets GitHub/plateforme de déploiement;
- validation finale UX/accessibilité sur appareils réels;
- déploiement production;
- raccordement Lovable PCS une fois les crédits du workspace disponibles.

Cette distinction reste volontaire : le backend et la base sont configurés pour une vraie application, mais la mise en production publique doit encore passer par la validation de build, les tests et le déploiement.
