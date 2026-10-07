# API et contrats applicatifs PCS

Privilégier Supabase. Utiliser des Edge Functions lorsque la logique doit rester côté serveur.

Opérations: créer un signalement, consulter ses signalements, consulter un signalement autorisé, gérer les médias, changer un statut, attribuer un signalement, créer une notification et consulter les statistiques autorisées.

Chaque opération valide identité, rôle, périmètre et données reçues.