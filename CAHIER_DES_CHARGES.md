# Cahier des charges — PCS

## Vision
PCS facilite le signalement, la localisation et le suivi des problèmes d’intérêt public afin de transformer un constat citoyen en dossier structuré, traçable et exploitable.

## Problème
Les signalements peuvent être dispersés entre appels, démarches physiques et réseaux sociaux, avec peu de traçabilité, de suivi et de données structurées.

## Causes profondes
- absence de canal numérique centralisé;
- dispersion des signalements;
- manque de référence et de suivi;
- difficulté de priorisation;
- faible exploitation des données de terrain.

## Publics
Citoyens, agents, modérateurs et administrateurs.

## MVP citoyen
Inscription/connexion; création d’un signalement; catégorie; titre; description; photos/fichiers; localisation GPS; référence unique; consultation; suivi; historique; notifications essentielles.

## MVP agent/admin
Tableau de bord; recherche et filtres; attribution; prise en charge; changement de statut; notes internes; catégories/services; statistiques de base; audit.

## Catégories initiales
Voirie, éclairage public, déchets/assainissement, eau, équipements publics, espaces publics, signalisation routière et catégories configurables.

## Statuts
Brouillon, envoyé, reçu, en cours de traitement, résolu, rejeté.

## Données d’un signalement
Identifiant, référence publique, auteur, catégorie, description, médias, coordonnées, zone/adresse, dates, statut, priorité, service assigné, historique et résolution.

## Workflow
Citoyen → création → validation → soumission → réception → attribution → traitement → résolution/rejet → notification → clôture.

## Sécurité
Supabase Auth, RLS, contrôle des rôles, validation serveur, contrôle des uploads, limitation des abus, audit et minimisation des données personnelles.

## Hors MVP
Paiements, intégrations opérateurs, IA avancée, reconnaissance automatique d’images et intégrations institutionnelles.

## Critères d’acceptation
Le citoyen peut créer un signalement complet, obtenir une référence et suivre son état. Un agent autorisé peut le traiter. Un administrateur peut configurer et auditer le système.

## 27. Exigences détaillées complémentaires

### 27.1 Référence
Chaque signalement soumis reçoit une référence lisible et unique. Elle ne doit pas révéler l’identifiant interne de base de données.

### 27.2 Historique
Chaque transition importante conserve acteur, date, ancien état, nouvel état et motif lorsqu’un motif est requis.

### 27.3 Visibilité
Chaque information doit être classée selon sa visibilité avant d’être exposée dans une requête ou une interface.

### 27.4 Résolution
Une résolution doit pouvoir être documentée par texte et, si nécessaire, média. Le citoyen doit être informé de la clôture selon les canaux activés.

### 27.5 Gouvernance
Les règles métier non encore validées sont des propositions et devront être confirmées avant migration de production.

## 28. Definition of Done MVP
Une fonctionnalité est considérée terminée lorsqu’elle est implémentée, sécurisée par les permissions appropriées, testée, documentée et vérifiée dans l’environnement cible. Aucun écran seul ne constitue une fonctionnalité terminée.
