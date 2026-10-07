# Architecture technique PCS

Frontend web/PWA → logique applicative → Supabase Auth/PostgreSQL/Storage/Edge Functions si nécessaire.

GitHub conserve le code et la documentation. Lovable sert à construire et maintenir l’application. Supabase fournit le backend et les données PCS.

Principes: TypeScript, modularité, séparation UI/logique/données, validation, RLS, secrets côté serveur, migrations versionnées, environnements development/staging/production.

Modules: Auth, profils, signalements, médias, localisation, workflow, notifications, administration, modération, statistiques et audit.

Aucun identifiant Supabase ne doit être inventé.