# Base de données PCS

## Tables proposées
profiles, roles, user_roles, categories, departments, reports, report_media, report_status_history, report_assignments, report_comments, notifications, audit_logs.

Les noms et contraintes définitifs seront validés avant migration. Les signalements conservent une référence publique, un auteur, une catégorie, une description, une localisation, un statut, une priorité et un historique.

PostGIS pourra être utilisé pour les recherches géographiques et la cartographie.

Toutes les tables exposées au client doivent avoir des politiques RLS explicites. Les migrations doivent être versionnées et reproductibles.