# Revue sécurité pré-production PCS

- RLS à vérifier sur toutes les tables.
- Tester qu’un citoyen ne lit jamais les données privées d’un autre.
- Tester les limites de périmètre des agents.
- Vérifier les politiques Storage avant activation des médias.
- Limiter taille et types de fichiers.
- Ajouter rate limiting/anti-spam côté infrastructure ou serveur.
- Vérifier les URLs de redirection Auth.
- Vérifier les secrets et variables d’environnement.
- Activer les logs et l’audit.
- Configurer sauvegardes et restauration.
- Revoir les dépendances avant production.
