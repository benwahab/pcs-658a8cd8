# Intégration du dépôt benwahab/PCS dans ce projet Lovable

## État actuel constaté
- Projet = squelette TanStack Start vierge (page d'accueil placeholder, aucune route, aucun composant métier, pas de PWA, pas de logo, pas d'auth côté code).
- `.lovable/project.json` : template `tanstack_start_ts_current` — à conserver tel quel.
- Supabase `rqraxjypjwsxcmjdwroy` déjà connecté ; le schéma existe déjà en base (reports, public_reports, report_media, field_agents, organizations, organization_units, mairies, communes/départements/régions, user_roles, roles, audit_logs, notifications, agent_login_challenges, fonctions RPC agency_*/organization_*/agent_*, resolve_commune_from_gps…). Aucune migration ne sera rejouée ni recréée.
- `supabase/migrations/` est absent localement : l'historique des migrations du dépôt devra être recopié à l'identique (fichiers seulement, sans exécution).
- Le dépôt GitHub privé n'est pas accessible depuis le bac à sable (authentification refusée). **Prérequis bloquant** : fournir le code (ZIP du dépôt en pièce jointe, ou connecter GitHub à ce projet).

## Étapes
1. **Acquisition** : recevoir le ZIP, l'inspecter sans exécuter aucun script (outil d'inspection de migration), produire un inventaire : framework, routes, dépendances, variables d'environnement, service worker/manifest, assets, migrations, edge functions.
2. **Registre de suivi** : `.lovable/migrate-external-project/ledger.json` listant chaque capacité (auth, rôles, offline, PWA, logo, RLS, médias, RPC, notifications, audit) avec statut.
3. **Copie fidèle** : composants, hooks, libs, styles, assets (logo, icônes PWA), `public/manifest`, service worker, `supabase/migrations/*` et `supabase/functions/*` à l'identique. Aucune réécriture fonctionnelle.
4. **Adaptation minimale au squelette TanStack** (seulement là où le code est incompatible, voir ci-dessous).
5. **Préservation** : `.lovable/project.json`, `.env`, `supabase/config.toml`, `src/integrations/supabase/*` (générés) restent intacts ; le client Supabase du dépôt est redirigé vers `@/integrations/supabase/client`.
6. **Vérification** : build, chaque route, connexion avec un vrai compte, contrôle des rôles (citoyen/agent/mairie/agence/admin), création d'un signalement, mode hors-ligne + resynchronisation, installation PWA, accès refusé entre utilisateurs.

## Incompatibilités probables (à confirmer à l'inspection)
- **Routeur** : si le dépôt utilise React Router (`BrowserRouter`, `src/pages`, `App.tsx`), conversion 1:1 de chaque page en fichier de route TanStack (`src/routes/...`) ; le contenu des pages reste inchangé, seuls `Link`/`useNavigate`/`useParams` sont remplacés.
- **Point d'entrée** : `main.tsx`/`index.html` supprimés au profit de `__root.tsx` (providers, `<Toaster />`, balises head, lien manifest, favicon/logo).
- **SSR** : le code accédant à `window`, `localStorage`, IndexedDB, `navigator.onLine`, géolocalisation, caméra doit être rendu côté client uniquement (`useEffect`, `ClientOnly`, import dynamique).
- **Routes protégées** : gardes d'authentification déplacées sous `src/routes/_authenticated/` (layout `ssr:false`), gardes par rôle conservées via `has_role`/`user_roles`.
- **PWA / Service worker** : `vite-plugin-pwa` doit être ajouté via `vite.config.ts` (option `vite.plugins`) sans dupliquer les plugins déjà inclus ; sinon manifest + SW statiques dans `public/` enregistrés côté client. Le SW ne doit pas mettre en cache les réponses SSR/serveur de façon incohérente.
- **Variables d'environnement** : noms `VITE_SUPABASE_*` compatibles ; toute clé privée passe par les Secrets, jamais dans le code.
- **Edge functions Supabase** : conservées et déployées telles quelles si elles servent des webhooks/SMS/OTP agents ; pas de migration forcée vers des fonctions serveur.
- **Dépendances** : versions TanStack du squelette conservées ; les autres dépendances du dépôt ajoutées ; toute librairie Node-only côté serveur signalée.
- **Tailwind** : si le dépôt est en Tailwind v3 (`tailwind.config.js`), ses tokens sont transposés dans `src/styles.css` (v4) sans changer le rendu.

## Détails techniques
- Aucun `DROP`, aucune nouvelle migration sauf écart constaté entre les migrations du dépôt et la base réelle (signalé avant action).
- `types.ts` régénéré depuis la base, non édité.
- Métadonnées head par route (titre PCS, description).

## Ce dont j'ai besoin de vous
Le code du dépôt : sur GitHub, ouvrez benwahab/PCS → bouton **Code** → **Download ZIP**, puis joignez le fichier ici.
