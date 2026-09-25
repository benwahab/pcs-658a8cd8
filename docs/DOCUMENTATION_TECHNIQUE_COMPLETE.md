# PCS — Documentation technique complète

> Document de référence technique consolidé du projet PCS.
>
> **Dépôt GitHub :** `benwahab/PCS`  
> **Branche de référence :** `main`  
> **Backend Supabase :** `rqraxjypjwsxcmjdwroy`  
> **Dernier état documenté :** commit `4ca5880704de5d31492a0b01e1a7df2d7d82661f`

## 1. Objet du projet

PCS — Plateforme de Citoyenneté et de Signalement — est une plateforme web/PWA permettant aux citoyens de signaler des problèmes d'intérêt public, de les localiser, de suivre leur évolution et de consulter les résolutions publiées.

Le système couvre plusieurs acteurs :

- citoyen ;
- mairie ;
- organisation ;
- unité/agence ;
- agent terrain ;
- modération ;
- administration.

Le workflow métier de référence est :

`Citoyen → Signalement → Mairie → Organisation → Unité/Agence → Agent terrain → Vérification GPS → Intervention → Vidéo de résolution → Résolution`

Les données métier sont conservées indépendamment de l'identité d'un compte utilisateur : la suppression d'un compte ne doit pas signifier la suppression de l'entité mairie/organisation ni de ses historiques métier.

---

## 2. Périmètre technique

### 2.1 Dépôt et backend

Le développement actuel est limité à :

- GitHub : `benwahab/PCS`
- Supabase : `rqraxjypjwsxcmjdwroy`

Le projet utilise GitHub pour le code, les migrations et la documentation.

Supabase fournit :

- Auth ;
- PostgreSQL ;
- RLS ;
- Storage ;
- Edge Functions ;
- RPC PostgreSQL ;
- données territoriales ;
- notifications et audit.

Lovable est documenté comme outil de construction/maintenance dans les documents historiques du dépôt, mais **aucune connexion ou migration Lovable n'est à effectuer dans l'état actuel sans instruction explicite**.

---

# 3. Architecture applicative

## 3.1 Vue générale

```
┌─────────────────────────────────────────────┐
│                  Client Web/PWA              │
│ React + TypeScript + React Router + Vite    │
├─────────────────────────────────────────────┤
│ UI / Pages / Components                     │
│ Services / Lib / Types                      │
├─────────────────────────────────────────────┤
│ Supabase JS                                 │
├─────────────────────────────────────────────┤
│ Supabase                                     │
│ ├─ Auth                                      │
│ ├─ PostgreSQL                                │
│ ├─ RLS                                       │
│ ├─ Storage: report-media                     │
│ ├─ Edge Functions                            │
│ └─ RPC SECURITY DEFINER contrôlées           │
└─────────────────────────────────────────────┘
```

Le frontend ne doit jamais contenir de secret serveur ou de clé `service_role`.

La sécurité réelle repose sur Supabase/RLS/RPC, et non sur le simple masquage de boutons dans l'interface.

---

# 4. Stack frontend

Le projet actuel utilise :

- React `19.1.1`
- React DOM `19.1.1`
- TypeScript `5.8.3`
- Vite `7.1.7`
- React Router DOM `7.9.1`
- `@supabase/supabase-js` `2.57.0`
- Driver.js `1.8.0`

Scripts principaux :

```bash
npm run dev
npm run typecheck
npm run build
npm run preview
```

Le CI utilise le build/typecheck du projet.

---

# 5. Structure du frontend

## 5.1 Entrée

- `src/main.tsx`
  - démarrage React ;
  - initialisation de l'application ;
  - gestion du splash screen.

- `src/App.tsx`
  - routes et shell principal ;
  - authentification/session ;
  - accès citoyen ;
  - accès opérationnel ;
  - navigation ;
  - intégration des dashboards.

## 5.2 Composants

- `src/components/BrandLogo.tsx`
  - logo officiel PCS.

- `src/components/OnboardingTour.tsx`
  - guide interactif Driver.js ;
  - éléments identifiés par `data-pcs-tour`.

## 5.3 Pages principales

- `src/pages/Dashboard.tsx`
- `src/pages/MairieDashboard.tsx`
- `src/pages/OrganizationDashboard.tsx`
- `src/pages/AgentTerrain.tsx`
- `src/pages/Admin.tsx`
- `src/pages/Moderation.tsx`
- `src/pages/Notifications.tsx`
- `src/pages/ReportDetail.tsx`

L'interface citoyenne principale est gérée depuis `App.tsx`.

## 5.4 Services

- `src/services/auth.ts`
- `src/services/permissions.ts`
- `src/services/admin.ts`
- `src/services/mairie.ts`
- `src/services/organization.ts`
- `src/services/media.ts`
- `src/services/offline.ts`
- `src/services/notifications.ts`

## 5.5 Bibliothèque métier

- `src/lib/reports.ts`
- `src/lib/supabase.ts`

## 5.6 Types

- `src/types.ts`
- `src/types/database.ts`

Le fichier database est généré depuis le schéma Supabase et sert de contrat TypeScript avec la base.

---

# 6. Routes et espaces fonctionnels

Le système distingue notamment :

### Citoyen

- accueil/feed public ;
- connexion ;
- création de signalement ;
- mes signalements ;
- détail d'un signalement ;
- notifications.

### Mairie

- connexion mairie ;
- création de compte mairie ;
- dashboard mairie ;
- consultation des signalements ;
- transmission à une organisation ;
- gestion des agents ;
- profil mairie.

### Agent terrain

- identification par téléphone ;
- challenge de connexion ;
- connexion ;
- missions ;
- vérification GPS ;
- traitement ;
- résolution avec vidéo ;
- fonctionnement offline.

### Organisation

- dashboard organisation ;
- réception des transferts ;
- acceptation/refus ;
- affectation à une unité/agence ;
- suivi des missions ;
- affectation à un agent.

### Administration/modération

- opérations ;
- administration ;
- modération ;
- notifications ;
- statistiques et audit selon les permissions.

---

# 7. Authentification

## 7.1 Citoyen

Le citoyen utilise Supabase Auth avec connexion par lien envoyé par email.

Le frontend utilise :

`supabase.auth.signInWithOtp(...)`

## 7.2 Mairie / organisation

Les comptes opérationnels utilisent une authentification email/mot de passe via Supabase Auth, avec vérification du rôle et du périmètre après connexion.

## 7.3 Agent terrain

L'agent terrain suit un flux spécifique :

1. saisie du téléphone professionnel ;
2. identification du compte ;
3. génération/récupération d'un challenge ;
4. validation du mot de passe ;
5. création/récupération de session Supabase ;
6. accès à `/agent-terrain`.

Edge Function concernée :

`supabase/functions/agent-login/index.ts`

Le challenge est stocké dans `agent_login_challenges`.

---

# 8. Création des comptes opérationnels

Edge Functions présentes :

- `supabase/functions/agent-login/index.ts`
- `supabase/functions/mairie-create-agent/index.ts`

Le frontend appelle également l'endpoint de création mairie :

`/functions/v1/mairie-signup`

et l'endpoint de création d'agent :

`/functions/v1/mairie-create-agent`

Les opérations privilégiées de création de comptes ne doivent pas être déplacées côté navigateur avec des secrets administratifs.

---

# 9. Modèle de données PostgreSQL

Les tables publiques actuellement présentes dans Supabase sont :

### Identité et rôles

- `profiles`
- `roles`
- `user_roles`

### Référentiels

- `regions`
- `communes`
- `categories`
- `departments`

### Mairies

- `mairies`

### Organisations

- `organizations`
- `organization_units`
- `organization_users`
- `unit_communes`

### Agents

- `field_agents`
- `agent_login_challenges`

### Signalements

- `reports`
- `report_media`
- `report_comments`
- `report_confirmations`

### Affectations et workflow

- `report_assignments`
- `report_unit_assignments`
- `report_organization_transfers`
- `report_field_verifications`

### Historique et communication

- `report_status_history`
- `notifications`
- `audit_logs`

---

# 10. Vues publiques

Trois vues publiques sont présentes :

- `public_reports`
- `public_report_media`
- `public_report_status_history`

Elles permettent d'exposer au citoyen les informations destinées à la publication sans donner un accès brut aux données privées.

Les vues publiques doivent rester protégées par leur définition et les règles d'accès adaptées.

---

# 11. Table reports

La table `reports` constitue le cœur métier.

Elle contient notamment :

- `id`
- `reference_code`
- `citizen_id`
- `category_id`
- `department_id`
- `title`
- `description`
- `status`
- `priority`
- `latitude`
- `longitude`
- `location_label`
- `resolution_note`
- `created_at`
- `updated_at`
- `resolved_at`
- `region_id`
- `commune_id`
- `is_public`

Contraintes importantes :

- titre : 5 à 120 caractères ;
- description : 10 à 5000 caractères ;
- référence publique unique ;
- statut contrôlé ;
- relation commune/région contrôlée.

Les champs cœur d'un signalement ne peuvent pas être librement réécrits après soumission.

---

# 12. États du signalement

Les états opérationnels utilisés par le workflow comprennent notamment :

- `submitted`
- `assigned`
- `accepted`
- `verification`
- `in_progress`
- `resolved`
- états de transfert/affectation spécifiques selon le sous-workflow.

Les transitions sont contrôlées par la base.

En particulier :

- `in_progress` nécessite une affectation agent active ;
- `resolved` nécessite une résolution valide ;
- `resolved_at` est maintenu par la logique de statut ;
- les affectations actives sont protégées contre les doublons.

---

# 13. Workflow citoyen

## Création

1. authentification ;
2. sélection de région ;
3. sélection de localité/commune ;
4. sélection de catégorie ;
5. titre ;
6. description ;
7. zone/adresse facultative ;
8. position GPS obligatoire ;
9. photos facultatives ;
10. soumission ;
11. génération d'une référence ;
12. suivi dans « Mes signalements ».

Contraintes frontend actuellement visibles :

- maximum 5 photos par signalement ;
- JPG/PNG/WebP ;
- 8 Mo maximum par image ;
- GPS requis ;
- titre 5–120 caractères ;
- description 10–5000 caractères.

Le backend reste l'autorité finale : les validations frontend ne remplacent pas les contraintes SQL/RLS.

---

# 14. Médias

Bucket Storage :

`report-media`

Le bucket est privé.

## Photos citoyennes

`uploadReportMedia()`

Contraintes frontend :

- JPEG ;
- PNG ;
- WebP ;
- maximum 8 Mo ;
- chemin organisé par `report_id`.

Après upload, une ligne `report_media` est créée.

En cas d'échec de l'insertion DB, le fichier Storage est supprimé pour éviter un fichier orphelin.

## Vidéo de résolution

`uploadResolutionVideo()`

Formats autorisés :

- MP4 ;
- WebM ;
- QuickTime/MOV.

Taille maximale :

- 50 Mo.

La vidéo de résolution contient notamment :

- `uploaded_by`
- `media_role = resolution_video`
- latitude ;
- longitude ;
- type MIME ;
- taille ;
- rapport associé.

La base impose également des contrôles indépendants du frontend.

---

# 15. Vérification GPS terrain

La vérification terrain est une étape de sécurité métier.

RPC :

`agent_confirm_field_verification`

Elle vérifie notamment :

- utilisateur authentifié ;
- coordonnées valides ;
- précision GPS ≤ 20 m ;
- affectation active ;
- rapport au statut attendu ;
- coordonnées du rapport ;
- distance agent/rapport ≤ 20 m.

Après validation :

- une ligne est enregistrée dans `report_field_verifications` ;
- l'affectation passe dans son état de traitement ;
- le rapport passe à `in_progress`.

---

# 16. Résolution terrain

RPC :

`agent_resolve_report`

Conditions contrôlées :

- utilisateur authentifié ;
- rapport en `in_progress` ;
- agent correctement affecté ;
- média appartenant au rapport ;
- média avec rôle `resolution_video` ;
- média uploadé par l'utilisateur ;
- MIME vidéo valide ;
- GPS de la vidéo présent ;
- GPS du rapport présent ;
- distance vidéo/rapport ≤ 20 m.

La résolution :

- enregistre la note de résolution ;
- passe le rapport à `resolved` ;
- termine l'affectation ;
- termine l'affectation d'unité associée.

---

# 17. Workflow mairie → organisation

La mairie peut consulter les organisations actives via :

`listActiveOrganizations()`

La transmission utilise :

`mairie_transmit_report`

Elle crée/actualise le transfert dans :

`report_organization_transfers`

L'organisation peut ensuite :

- accepter ;
- refuser ;
- affecter le dossier à une unité/agence.

RPC :

- `organization_accept_transfer`
- `organization_decline_transfer`
- `organization_assign_agency`

---

# 18. Workflow organisation → agence → agent

L'organisation possède un rattachement via :

`organization_users`

Une organisation peut avoir :

- unité centrale ;
- agence.

Les unités sont décrites dans :

`organization_units`

Les communes couvertes sont liées via :

`unit_communes`

Une mission d'unité est représentée par :

`report_unit_assignments`

L'agence/unité peut affecter le rapport à un agent via :

`agency_assign_report_to_agent`

La fonction vérifie notamment :

- unité active ;
- organisation correcte ;
- rôle autorisé ;
- agent appartenant à la même organisation/unité ;
- agent actif ;
- absence d'affectation active concurrente.

---

# 19. Affectations

Deux niveaux existent :

### Affectation organisationnelle

`report_unit_assignments`

Elle représente l'affectation du rapport à une organisation/unité.

### Affectation agent

`report_assignments`

Elle représente la mission opérationnelle d'un agent.

Des index uniques partiels empêchent plusieurs affectations actives concurrentes pour un même rapport.

Les agents ne doivent pas modifier librement les affectations par UPDATE direct : les opérations métier passent par les RPC prévues.

---

# 20. Offline / terrain

Le terrain utilise IndexedDB.

Base :

`pcs-offline-v1`

Version actuelle :

`2`

Stores principaux :

- `field-verifications`
- `resolution-videos`

Les missions peuvent également être mises en cache via localStorage.

## Fonctionnement

### Hors connexion

Les opérations terrain sont placées dans une file locale.

### Retour en ligne

Les files sont vidées :

- vérification GPS ;
- upload vidéo ;
- résolution.

Une opération réussie est retirée de la file.

Une opération qui échoue reste disponible pour une nouvelle tentative.

Le flux de résolution a été rendu idempotent afin d'éviter une double résolution après reprise réseau.

---

# 21. Services offline

Fichier :

`src/services/offline.ts`

Responsabilités :

- ouverture/versionnement IndexedDB ;
- mise en file ;
- récupération ;
- synchronisation ;
- comptage des éléments en attente ;
- cache des missions.

Fichier :

`src/pages/AgentTerrain.tsx`

Responsabilités :

- chargement serveur ;
- fallback offline ;
- GPS haute précision ;
- affichage des missions ;
- synchronisation ;
- résolution terrain.

---

# 22. Permissions et sécurité

La sécurité PCS suit le principe du moindre privilège.

Les contrôles ne reposent pas uniquement sur :

`if (role === ...)`

dans React.

La base applique :

- RLS ;
- contraintes ;
- fonctions sécurisées ;
- vérifications d'identité ;
- vérifications de périmètre ;
- contrôles de statut ;
- contrôles de propriété.

Le frontend ne doit jamais être considéré comme une frontière de sécurité.

---

# 23. Fonctions PostgreSQL SECURITY DEFINER

Les fonctions SECURITY DEFINER actuellement présentes comprennent notamment :

- `agency_assign_report_to_agent`
- `agency_attach_agent`
- `agency_can_manage_agent`
- `agent_confirm_field_verification`
- `agent_resolve_report`
- `audit_assignment_change`
- `audit_report_update`
- `generate_report_reference`
- `handle_new_user`
- `has_role`
- `is_staff`
- `mairie_transmit_report`
- `notify_assignment_change`
- `notify_report_status_change`
- `organization_accept_transfer`
- `organization_assign_agency`
- `organization_create_agency`
- `organization_decline_transfer`
- `record_report_status_change`
- `resolve_commune_from_gps`
- `validate_report_update`
- `validate_resolution_note`

Une vérification récente a confirmé qu'aucune fonction SECURITY DEFINER de `public` n'est exécutable par `anon`.

La fonction `agency_can_manage_agent(uuid)` a notamment fait l'objet d'une correction explicite de son EXECUTE par défaut.

---

# 24. RLS et privilèges

Des restrictions ont été appliquées aux tables sensibles :

- `organization_users`
- `user_roles`
- `organization_units`
- `mairies`
- `profiles`

Les privilèges directs authenticated ont également été réduits lorsque les opérations doivent passer par des fonctions métier.

Des politiques RLS redondantes permissives ont été supprimées.

Certaines expressions `auth.uid()` ont été optimisées sous forme de sous-requête stable afin de limiter les évaluations répétées par ligne.

---

# 25. Audit et historique

PCS possède plusieurs mécanismes complémentaires :

- `audit_logs`
- `report_status_history`
- `notifications`
- `public_report_status_history`

Les changements de statut sont historisés.

Les changements d'affectation sont également audités.

L'historique métier ne doit pas être considéré comme appartenant exclusivement au compte utilisateur qui a réalisé l'action.

---

# 26. Notifications

Table :

`notifications`

Service frontend :

`src/services/notifications.ts`

Les notifications peuvent être déclenchées lors des changements de statut et des changements d'affectation via les fonctions de notification PostgreSQL.

Les notifications sont rattachées à un utilisateur et peuvent être consultées dans l'espace approprié.

---

# 27. Confirmations citoyennes

Table :

`report_confirmations`

Un citoyen peut confirmer un signalement existant.

Le service frontend expose :

- `confirmReport()`
- `countConfirmations()`

Les doublons sont contrôlés côté base.

---

# 28. Référencement des signalements

Chaque signalement possède :

`reference_code`

La génération est gérée par :

`generate_report_reference`

La référence est destinée à fournir un identifiant utilisable dans l'interface et les échanges opérationnels.

---

# 29. Données territoriales

Le territoire est structuré au minimum par :

`regions → communes`

Les rapports portent notamment :

- `region_id`
- `commune_id`

Une contrainte composite commune/région protège la cohérence territoriale.

Le frontend charge les régions puis les communes correspondant à la région sélectionnée.

Pour Niamey, la logique actuelle traite la localité de la Ville de Niamey conformément aux données territoriales présentes dans la base.

---

# 30. Organisation des données métier

Principe important :

**Le compte utilisateur n'est pas l'entité métier.**

Exemple :

```
Compte utilisateur mairie
        │
        └── accès à
             │
             ▼
           Mairie
             │
             ├── signalements
             ├── historique
             ├── statistiques
             └── opérations
```

Ainsi, supprimer un compte utilisateur ne doit pas supprimer les signalements ou les statistiques de la mairie.

La recréation d'un compte correctement rattaché à la même entité doit permettre de retrouver les données correspondant à son périmètre.

---

# 31. Suppression de compte

La suppression d'un compte Auth peut entraîner les cascades prévues par les clés étrangères de certaines tables liées à l'identité.

Cependant, les données métier ne doivent pas être supprimées simplement parce qu'un compte disparaît.

Les relations historiques qui doivent conserver une trace doivent rester indépendantes de l'identité personnelle lorsque cela est nécessaire.

Ce sujet doit rester séparé du nettoyage explicite des données de test.

---

# 32. Storage et confidentialité

Le bucket :

`report-media`

est privé.

Les fichiers sont servis au frontend par URLs signées.

La fonction :

`createReportMediaUrl(path, expiresIn)`

crée une URL temporaire.

Les politiques Storage distinguent les usages :

- preuve citoyenne ;
- vidéo de résolution.

Les uploads de résolution nécessitent notamment une affectation agent active, un rapport au bon statut et un fichier vidéo autorisé.

---

# 33. PWA

Assets principaux :

- `public/assets/pcs-logo.jpg`
- `public/assets/pcs-splash.jpg`
- `public/icons/icon-192.jpg`
- `public/icons/icon-512.jpg`
- `public/manifest.webmanifest`
- `public/sw.js`

Le service worker utilise le cache shell :

`pcs-shell-v2`

Le splash screen est géré au démarrage de l'application.

---

# 34. Identité visuelle

Palette principale :

| Usage | Couleur |
|---|---|
| Vert PCS principal | `#0D6B4F` |
| Teal secondaire | `#0F766E` |
| Vert pâle | `#EAF5F0` |
| Fond | `#F5F7F6` / `#F6F8F7` |
| Blanc | `#FFFFFF` |
| Texte principal | `#172033` |
| Texte secondaire | `#687477` |
| Ambre | `#E5A83B` |
| Violet | `#8B6BC4` |
| Bleu | `#4C8FD7` |
| Rouge | `#D75A50` |
| Erreur | `#B42318` |

Le style recherché est professionnel, moderne et sobre.

Un effet hover a été ajouté aux boutons principaux :

- translation verticale légère ;
- ombre ;
- changement subtil de teinte ;
- état actif ;
- prise en compte de `prefers-reduced-motion`.

Commit : `4ca5880704de5d31492a0b01e1a7df2d7d82661f`.

---

# 35. Onboarding

Le composant :

`src/components/OnboardingTour.tsx`

utilise Driver.js.

Les éléments sont repérés par des attributs :

`data-pcs-tour="..."`

Le guide est destiné à expliquer les principaux boutons et zones de l'interface.

La logique de déclenchement doit rester limitée à la première visite conformément à la décision produit utilisant le stockage local du navigateur.

---

# 36. Migrations Supabase

Les migrations historiques commencent par les fondations :

- schéma initial ;
- sécurité ;
- profils ;
- Storage ;
- historique ;
- workflow ;
- rôles ;
- RLS ;
- notifications ;
- audit ;
- résolution ;
- périmètres territoriaux ;
- organisations ;
- transferts ;
- agences ;
- affectations.

Les migrations de durcissement les plus récentes comprennent notamment :

- `20260923000000_harden_agent_assignment_state_and_resolution_closure.sql`
- `20260923000001_harden_report_status_assignment_checks.sql`
- `20260923000002_add_missing_foreign_key_indexes.sql`
- `20260923000003_remove_redundant_permissive_rls_policies.sql`
- `20260923000004_optimize_rls_auth_uid_evaluation.sql`
- `20260923000005_revoke_anon_agency_agent_helper.sql`
- `20260923000006_tighten_authenticated_rls_policies.sql`
- `20260923000007_deduplicate_report_insert_rls.sql`
- `20260923000008_prevent_field_agent_scope_self_escalation.sql`
- `20260923000009_revoke_anon_agency_helper_final.sql`
- `20260923000010_revoke_anon_security_definer_helper_verified.sql`
- `20260923000011_restrict_anon_sensitive_table_privileges.sql`
- `20260923000012_restrict_authenticated_sensitive_table_grants.sql`
- `20260923000013_prevent_agent_direct_assignment_mutation.sql`
- `20260923000014_lock_report_core_fields_after_submission.sql`
- `20260923000015_tighten_mairie_report_editable_fields.sql`
- `20260923000016_lock_report_media_metadata_after_upload.sql`
- `20260923000017_harden_report_media_storage_upload_policy.sql`
- `20260923000018_fix_agency_helper_default_execute_grant.sql`

Les migrations restent la source de vérité reproductible du schéma.

---

# 37. Performance

Travaux réalisés :

- index manquants sur clés étrangères ;
- suppression de politiques RLS permissives redondantes ;
- optimisation de certaines évaluations `auth.uid()` ;
- index opérationnels sur les relations critiques.

Les index actuellement peu utilisés ne sont pas nécessairement un problème : la base opérationnelle était encore très peu peuplée au dernier audit.

La performance doit être réévaluée avec de vraies données.

---

# 38. CI/CD

Le dépôt possède :

`.github/workflows/ci.yml`

Les vérifications principales portent sur la compilation/typecheck et le build.

Les derniers runs connus vérifiés avant la dernière modification purement visuelle étaient :

- CI #191 : succès ;
- CI #192 : succès ;
- SHA vérifié : `af4a5ff59ecac9853d9de9f7332a8e736401055b`.

Aucun test navigateur/mobile réel ne doit être présenté comme réalisé tant qu'il n'a pas été exécuté et vérifié.

---

# 39. Variables d'environnement

Le fichier :

`.env.example`

sert de modèle.

Le frontend attend notamment les paramètres publics Supabase nécessaires au client.

Aucun secret de type service role ne doit être placé dans :

- le frontend ;
- GitHub ;
- les fichiers publics ;
- les variables `VITE_*`.

Les opérations privilégiées doivent rester côté serveur/Edge Function/PostgreSQL sécurisé.

---

# 40. Stratégie de test

La prochaine phase majeure est le test avec de vraies données contrôlées.

## Comptes

Créer des comptes de test représentant :

- citoyen ;
- mairie ;
- organisation ;
- agence/unité ;
- agent terrain ;
- administrateur si nécessaire.

## Scénario bout en bout

1. citoyen crée un signalement ;
2. photos et GPS ;
3. mairie réceptionne ;
4. mairie transmet ;
5. organisation accepte ;
6. organisation affecte l'unité ;
7. unité affecte l'agent ;
8. agent vérifie le GPS ;
9. agent traite ;
10. agent capture la vidéo ;
11. vidéo uploadée ;
12. RPC de résolution ;
13. rapport résolu ;
14. statistiques et historiques vérifiés ;
15. notifications vérifiées.

## Cas négatifs

Tester notamment :

- mauvais rôle ;
- mauvais périmètre ;
- agent inactif ;
- agent non affecté ;
- GPS trop éloigné ;
- précision GPS > 20 m ;
- vidéo non vidéo ;
- vidéo trop volumineuse ;
- double affectation ;
- modification d'un champ verrouillé ;
- transfert refusé ;
- tentative d'accès à un autre périmètre ;
- tentative de mutation directe interdite ;
- fonctionnement sans réseau ;
- reprise après perte réseau.

---

# 41. Données de test

Les données territoriales existantes sont réelles :

- 8 régions ;
- 262 communes ;
- 2 organisations ;
- 2 unités ;
- 8 catégories ;
- 6 départements ;
- 6 rôles.

Les tables opérationnelles étaient encore vides au dernier audit.

Ne pas fabriquer un grand volume de données fictives uniquement pour remplir les dashboards.

Les tests doivent commencer avec un petit jeu de comptes et de scénarios contrôlés, puis augmenter progressivement.

---

# 42. Nettoyage des tests

La suppression d'un compte de test n'implique pas automatiquement la suppression des données métier.

Le nettoyage des données de test doit être une opération distincte et explicitement identifiée.

Cela permet de préserver la logique réelle :

- compte utilisateur ;
- entité mairie/organisation ;
- signalement ;
- historique ;
- statistiques.

---

# 43. Points à surveiller avant production

Les éléments suivants restent à valider avec les tests réels :

- comportement complet des dashboards avec données ;
- cohérence des statistiques ;
- expérience mobile réelle ;
- expérience navigateur réelle ;
- robustesse offline sur appareils réels ;
- performances avec volume de données ;
- tests de toutes les permissions ;
- tests Storage avec utilisateurs réels ;
- validation des parcours de création de comptes ;
- vérification finale des politiques RLS ;
- restauration/sauvegarde opérationnelle ;
- surveillance et logs ;
- stratégie de données de production.

---

# 44. Historique des décisions techniques importantes

### Sécurité
Les opérations sensibles doivent être autorisées côté base, pas seulement côté interface.

### Agent terrain
La localisation terrain est une condition métier : précision ≤ 20 m et proximité ≤ 20 m.

### Résolution
Une résolution valide doit être accompagnée d'une vidéo de résolution contrôlée.

### Affectation
Un rapport ne doit pas avoir plusieurs affectations actives concurrentes.

### Médias
Le bucket est privé et les fichiers sont servis par URLs signées.

### Territoire
Les communes sont rattachées à une région et les périmètres opérationnels sont contrôlés.

### Compte vs entité
La suppression d'un compte utilisateur ne doit pas supprimer les données métier de la mairie/organisation.

### Visual
La palette PCS est stable et la finition visuelle peut évoluer sans modifier le workflow métier.

### Lovable
Aucune connexion Lovable n'est à effectuer dans la phase actuelle.

---

# 45. Commits de référence

## Backend / sécurité

- `e17361252fae0165baf0051bc2d7bd79319d61b6`
- `04d9e5e23b5ff8a72ecbe447ed10a7db4cb2aa63`
- `b18400f43bd7b289bf0046edf08859015cd21e3f`
- `8d64b7ca9a67adbca6e560839d4daa9b59ee49ee`
- `0e175c5e117c28de5efcf1d2538ccf1b96f5ee06`
- `4d91170aa5f2992f83feeade9443b56387711ad8`
- `d2764a68b6603cb918890022da9eca5fd0467a77`
- `43b4da4482e022e7660bb93d5b125791b3d0b075`
- `33d048d1f78a4aebd989d11ee3e84816328b0878`
- `2d61ce42cd8665a677b6df2074554644da9556bd`
- `3fc678bb8820071ca81ab3561901f45cef973ca3`
- `58f3036534572260fafbc2f7a6ff2ee58493ff6b`

## Terrain / offline

- `3ebea2132946bb025b417e7ed3af43141df7314c`
- `2e712a4199bd22f7da68d0580c06aa210ce25673`
- `981474f39e76e10f9f6c25b2bb88abf05ef97c6d`
- `af4a5ff59ecac9853d9de9f7332a8e736401055b`

## Mairie / organisation

- `83080f9f228b3ed6fb039c4c420bd76518afbde0`

## Identité visuelle

- `b374dc45c76118b6ef6ea343308d77ceece28433`

## UI

- `4ca5880704de5d31492a0b01e1a7df2d7d82661f`

---

# 46. Maintenance

Toute modification importante doit suivre ce cycle :

1. inspecter l'état actuel ;
2. identifier le fichier ou la migration concernée ;
3. vérifier les contraintes existantes ;
4. modifier uniquement ce qui est nécessaire ;
5. exécuter les vérifications ;
6. contrôler les effets de bord ;
7. commit Git ;
8. vérifier le CI ;
9. mettre à jour la documentation si le comportement change.

Pour une modification Supabase :

1. vérifier la documentation Supabase actuelle ;
2. inspecter le schéma réel ;
3. faire le changement via migration ;
4. vérifier RLS/SECURITY DEFINER/Storage ;
5. exécuter un test réel ;
6. vérifier les advisors lorsque pertinent.

---

# 47. Principe de continuité

Cette documentation décrit l'état du projet au moment de sa création. Elle ne remplace pas la vérification du dépôt et de Supabase.

Lors d'une nouvelle session de travail :

- vérifier `benwahab/PCS` ;
- vérifier `rqraxjypjwsxcmjdwroy` ;
- comparer avec cette documentation ;
- reprendre le travail là où il s'est arrêté ;
- ne jamais reconstruire le projet sans raison.

## Prochaine étape officielle

**Phase de test avec de vraies données contrôlées.**

Le premier compte opérationnel prévu pour cette phase est le compte dashboard de la **mairie centrale de Niamey**.
