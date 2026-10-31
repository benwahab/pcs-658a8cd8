# PCS — Préparation de l’intégration vidéo Cloudflare Stream

> Statut : préparation documentaire uniquement. Aucun service Cloudflare n’est connecté, aucun flux de production n’est modifié et aucune dépense n’est engagée.

## 1. Décision à conserver

- Supabase reste le cœur de PCS : base de données, authentification professionnelle, stockage des originaux, modération, permissions et état de publication.
- Cloudflare Stream sera envisagé plus tard comme unique service externe spécialisé pour l’encodage vidéo et la diffusion adaptative (HLS/DASH).
- Ne pas louer de VPS et ne pas administrer de serveur FFmpeg en production dans le cadre de cette décision.
- Ne pas connecter Cloudflare avant une décision explicite de l’utilisateur et une vérification du coût, du compte, des clés et des limites de facturation.
- Pour les tests préalables sans coût Cloudflare : utiliser des fichiers de test non sensibles et un FFmpeg local ou un environnement temporaire contrôlé. Ne jamais envoyer des vidéos citoyennes réelles vers un service externe sans autorisation explicite.

## 2. État existant à préserver

- Le bucket Supabase `report-media` est privé.
- Les médias citoyens et les vidéos de résolution ont des règles d’accès distinctes.
- La diffusion publique est conditionnée à l’approbation de modération et à la publication du signalement.
- La fonction `public-report-media-url` contrôle actuellement le statut approuvé et le caractère public du signalement avant de produire une URL signée.
- Le parcours de dépôt, les règles CST/modérateurs régionaux, les tableaux de bord mairie/Nigelec/NDE, les vidéos de résolution et les médias déjà publiés ne doivent pas être régressés.
- La limite vidéo connue est de 100 Mo. Ne pas introduire de limite de durée ni de conversion destructive sans décision distincte.
- Les originaux doivent rester conservés dans Supabase. Les rendus Stream seront des dérivés, jamais un remplacement silencieux des originaux.

## 3. Architecture cible future

1. Le navigateur envoie le média original à Supabase selon le parcours actuel.
2. Le média reste privé et suit le processus actuel de modération.
3. Aucun transfert vers Cloudflare ne se produit avant l’approbation requise.
4. Un traitement serveur de confiance vérifie à nouveau l’approbation, la publication, le type de média et son rôle avant de transmettre l’original à Stream.
5. Le traitement enregistre l’identifiant Stream et l’état de traitement dans des champs internes dédiés, sans exposer de secret au navigateur.
6. Un webhook Cloudflare authentifié met à jour l’état de traitement après validation de sa signature et de l’événement.
7. Le client ne reçoit une lecture adaptative qu’après vérification des autorisations actuelles côté PCS.
8. Le lecteur utilise la lecture adaptative automatique. Aucun sélecteur manuel de qualité ne doit être ajouté à l’interface citoyenne.

## 4. Exigences de sécurité non négociables

- Ne jamais exposer une clé API Cloudflare, un jeton API ou une clé Supabase service_role dans le navigateur, le dépôt public, les journaux ou les réponses publiques.
- Garder les originaux dans le bucket Supabase privé.
- Ne jamais considérer un identifiant Stream comme une preuve d’autorisation.
- Les jetons de lecture doivent être générés côté serveur après contrôle actuel des droits, avec une durée courte adaptée.
- Les vidéos en attente, rejetées, supprimées ou non publiées ne doivent jamais être lisibles publiquement.
- La révocation d’une approbation ou le retrait de publication doit bloquer les nouvelles lectures et déclencher, selon le comportement de l’API vérifié au moment de l’intégration, la suppression ou la désactivation du dérivé Stream.
- Les médias citoyens et les vidéos de résolution doivent conserver des contrôles d’accès séparés. Ne pas rendre publiques les vidéos de résolution par simple réutilisation de la règle citoyenne.
- Valider les webhooks (signature, horodatage si disponible, anti-rejeu/idempotence, événement attendu). Ne jamais faire confiance à un webhook non authentifié.
- Prévoir les reprises de traitement, les erreurs, les doublons, les suppressions et les échecs partiels sans publier un média par défaut.
- Respecter les conditions de conservation, suppression et protection des données applicables à PCS.

## 5. Modèle d’état à prévoir (à concevoir après audit du schéma)

Ne pas créer de colonnes maintenant. Lors de l’intégration, auditer d’abord le schéma réel puis choisir les champs minimaux, par exemple :
- fournisseur vidéo ;
- identifiant de l’actif Stream ;
- état d’encodage (non demandé, en attente, prêt, échec, suppression demandée, supprimé) ;
- date de dernière tentative et code d’erreur non sensible ;
- date de synchronisation du webhook.

Ces champs ne doivent jamais remplacer les statuts métier de modération et de publication. Un média ne devient pas approuvé parce que son encodage est terminé.

## 6. Déclenchement et séparation des responsabilités

- Déclenchement uniquement après validation CST ou modérateur autorisé et publication effective.
- Traitement idempotent : une même approbation ne doit pas créer plusieurs actifs Stream.
- Le traitement vidéo ne doit pas modifier le statut de modération.
- Un échec d’encodage ne doit ni supprimer l’original ni changer l’état métier du signalement.
- Prévoir une tâche de réconciliation pour détecter les actifs Stream orphelins et les médias approuvés dont le traitement est bloqué.
- Prévoir une suppression coordonnée lors de la suppression légitime d’un média ou d’un signalement.

## 7. Plan d’exécution futur

### Phase A — Préparation sans frais
- Garder Supabase et le lecteur actuels en production.
- Utiliser des médias synthétiques ou explicitement autorisés.
- Tester FFmpeg localement : HLS multi-renditions, démarrage, reprise, recherche, changement automatique de qualité et réseau lent.
- Mesurer la qualité visuelle et le poids des rendus.
- Ne pas intégrer de données Cloudflare de production.

### Phase B — Décision et configuration
- Vérifier la tarification Cloudflare Stream au jour de l’intégration, les quotas, les règles de facturation et les conditions de conservation.
- Faire valider le budget et le compte par l’utilisateur.
- Configurer les secrets côté serveur uniquement.
- Vérifier les environnements de test et de production séparément.

### Phase C — Intégration isolée
- Auditer le code et le schéma Supabase actuels avant toute modification.
- Ajouter le traitement serveur, la gestion des webhooks, les champs minimaux et la délivrance sécurisée des jetons.
- Garder un mécanisme de retour au lecteur actuel tant que les tests ne sont pas validés.
- Ne pas changer le dépôt citoyen, la modération, les permissions, le routage ou les workflows de résolution.

### Phase D — Validation avant activation
Tester au minimum :
- média en attente, rejeté, approuvé et publié ;
- retrait d’approbation et retrait de publication ;
- citoyen et vidéo de résolution ;
- accès anonyme, accès professionnel et accès non autorisé ;
- jeton expiré, webhook falsifié, webhook dupliqué ;
- encodage échoué, reprise et suppression ;
- Android/mobile, faible débit, reprise, recherche et changement automatique de qualité.

### Phase E — Mise en production progressive
- Activer d’abord sur un petit ensemble de médias de test approuvés.
- Comparer les résultats avec le lecteur existant.
- Surveiller coûts, minutes stockées, minutes diffusées, erreurs et latence.
- Étendre seulement après validation explicite.
- Conserver la possibilité de revenir au lecteur Supabase actuel sans perdre les originaux.

## 8. Interdictions / garde-fous de projet

- Ne pas créer de nouvelle branche Git : travailler sur `main` uniquement.
- Ne pas modifier la base Supabase, les buckets, les politiques RLS, les Edge Functions ou le code de production pendant cette phase documentaire.
- Ne pas ajouter de dépendance Cloudflare ni de variable d’environnement Cloudflare maintenant.
- Ne pas modifier les limites de dépôt, le parcours citoyen, la modération ou les permissions.
- Ne pas déployer de fonction ou de webhook Cloudflare avant autorisation explicite.
- Ne pas annoncer une intégration réalisée tant qu’elle n’a pas été déployée et vérifiée.

## 9. Point de reprise pour une future discussion

Quand l’utilisateur dira de reprendre l’intégration Cloudflare vidéo PCS :
1. relire ce document ;
2. vérifier que le dépôt est bien `benwahab/pcs-658a8cd8`, branche `main`, et Supabase `rqraxjypjwsxcmjdwroy` ;
3. auditer le code, les fonctions, le schéma, les buckets et les règles actuels ;
4. consulter la documentation et la tarification Cloudflare Stream à jour ;
5. demander confirmation avant toute dépense ou connexion de compte ;
6. exécuter par petites étapes, vérifier tests/CI et synchronisation Lovable ;
7. préserver tous les garde-fous ci-dessus.

---
Dernière préparation documentaire : 2026-10-31.
