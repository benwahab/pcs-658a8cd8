# Déploiement PCS

Chaîne cible: GitHub → CI/CD → environnement → Supabase correspondant.

Avant production: variables d’environnement, migrations validées, RLS vérifiées, secrets hors dépôt, tests, sauvegardes, logs et procédure de rollback.

Le projet Supabase de production doit être explicitement identifié et séparé des environnements de développement.