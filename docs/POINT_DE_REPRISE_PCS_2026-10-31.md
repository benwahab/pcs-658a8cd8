# PCS — Point de sauvegarde et de reprise intégrale
**Date du point de sauvegarde : 31 octobre 2026**  
**Objectif : reprendre le travail dans une nouvelle discussion sans perdre le contexte, les décisions, les contraintes ni l'état technique.**

---

## 1. Identité du projet — ne jamais confondre

- Nom : **PCS — Plateforme citoyenne de signalement**.
- Dépôt GitHub : `benwahab/pcs-658a8cd8`.
- Branche de travail : **`main` uniquement**.
- Projet Supabase PCS : `rqraxjypjwsxcmjdwroy`.
- Projet Lovable : `1de9a97f-0ae5-43ff-aaa0-90099116a7ec`.
- URL Lovable : https://lovable.dev/projects/1de9a97f-0ae5-43ff-aaa0-90099116a7ec
- Aperçu : https://id-preview--1de9a97f-0ae5-43ff-aaa0-90099116a7ec.lovable.app

**Attention absolue :** ne pas confondre PCS avec Coup Sûr. Le projet Coup Sûr utilise un autre dépôt et un autre Supabase. Ne jamais toucher à ces ressources pour une tâche PCS.

## 2. Règles impératives de travail

1. Toutes les modifications de code PCS doivent être faites directement sur le dépôt GitHub indiqué, branche `main`.
2. **Ne jamais créer de branche supplémentaire**, de branche temporaire ou de branche de sauvegarde.
3. Ne pas utiliser un ancien dépôt ou une ancienne copie du projet.
4. Faire un audit ciblé de l'existant avant chaque modification : lire les fichiers concernés, comprendre le flux réel et repérer les dépendances.
5. Modifier uniquement ce qui est nécessaire à la demande. Pas de refonte, de nettoyage, de changement d'architecture ou de refactorisation non demandé.
6. Préserver les données, les comptes, les permissions, les règles RLS, les fonctions Edge, les flux de signalement, la modération et les parcours professionnels.
7. Ne jamais introduire de données fictives, de comptes de démonstration, de fausses statistiques ou de comportements simulés en production.
8. Ne jamais annoncer qu'une modification, une synchronisation, un test ou un déploiement est réussi sans l'avoir vérifié.
9. Après chaque modification : contrôler le commit sur `main`, l'exécution CI GitHub et la synchronisation Lovable. Un statut CI vide ou absent ne prouve pas que les tests sont réussis.
10. Pour toute tâche Supabase, lire d'abord la compétence Supabase installée et examiner le schéma, les fonctions et les politiques concernés avant d'agir.
11. Demander une autorisation explicite avant toute dépense, connexion à un service payant, migration risquée, suppression de données ou changement qui dépasse la demande.
12. Ne pas modifier le flux de capture ou de sélection des médias sans demande explicite.
13. Si une demande est ambiguë et qu'une décision pourrait modifier le comportement du produit, poser une seule question de clarification avant d'agir.
14. L'utilisateur attend une exécution réelle et des vérifications, pas seulement des conseils ou un prompt à copier.

## 3. État exact du dernier changement — 31 octobre 2026

### Demande
L'utilisateur a constaté que les textes noirs de la page d'accueil étaient peu visibles sur l'image de fond. Il a confirmé qu'il voulait les textes en blanc.

### Modification exécutée
- Fichier modifié : `src/styles.css`.
- Changement limité aux textes du contenu de la diapositive d'introduction de l'accueil :
  - titres `h1`,
  - texte fort à l'intérieur du titre `h1 strong`,
  - paragraphes `p:not(.eyebrow)`.
- Couleur forcée en blanc avec `color: #FFFFFF !important` et `-webkit-text-fill-color: #FFFFFF !important`.
- Ajout d'une ombre de texte légère pour améliorer la lisibilité sur l'image.
- Aucun autre écran, flux métier, composant fonctionnel, règle Supabase ou permission n'a été modifié dans ce changement.

### Commit et contrôles
- Commit : `279c4bcd3e10cf1b36797005e368402bf9176e7d`.
- Message : `Restore white text contrast on PCS homepage`.
- Branche : `main`.
- CI GitHub : **réussi**, run nº **853**, ID `41214132820`.
- URL CI : https://github.com/benwahab/pcs-658a8cd8/actions/runs/41214132820
- URL du commit : https://github.com/benwahab/pcs-658a8cd8/commit/279c4bcd3e10cf1b36797005e368402bf9176e7d
- Synchronisation Lovable vérifiée : `latest_commit_sha` correspond exactement au commit ci-dessus ; projet en état `ready`, `agentFinished=true`.
- Aperçu à contrôler visuellement sur téléphone : https://id-preview--1de9a97f-0ae5-43ff-aaa0-90099116a7ec.lovable.app

**À la reprise :** ne pas refaire ce changement. Vérifier d'abord si le rendu blanc est bien visible sur l'aperçu ou sur l'application installée. Si un nouveau problème est signalé, diagnostiquer précisément avant de modifier.

## 4. Architecture et règles fonctionnelles du PCS

### Plateforme citoyenne
- PWA nationale destinée au Niger, utilisable sur téléphone et avec des connexions faibles.
- Les citoyens ne créent pas de compte et ne se connectent pas pour signaler.
- Les médias non approuvés ne doivent jamais apparaître sur la page d'accueil publique ni dans l'espace mairie.
- Seuls les médias validés par la modération peuvent être rendus publics.
- Si un signalement ne contient pas de vidéo, une photo est requise.
- Le bouton de réaction citoyenne est « Je confirme », pas « J'aime ».
- Les commentaires sont facultatifs et peuvent être ouverts ou fermés ; l'utilisateur ne doit pas être forcé à commenter.
- Les statuts des vidéos/signalements doivent rester visibles, notamment « en cours de vérification », « prise en charge » et « résolu ».
- Après envoi d'un signalement, l'écran de remerciement dure 3 secondes puis revient au contexte d'origine (accueil ou vidéo).
- Les vidéos doivent démarrer rapidement, occuper correctement l'écran sans bandes noires et éviter l'affichage d'une image partiellement chargée.
- Prévoir une expérience robuste en réseau faible, adaptée au contexte nigérien.
- Les indices de défilement de l'accueil ne doivent pas masquer le bouton Signaler et doivent pouvoir réapparaître après un délai.

### Modération et accès
- Le CST contrôle la modération des signalements.
- Le CST peut attribuer un modérateur régional ; ce modérateur ne traite que les signalements de sa région tant que son accès est actif.
- Le CST peut retirer l'accès du modérateur régional ; les signalements reviennent alors au contrôle CST.
- Les médias en attente ou rejetés ne sont jamais accessibles publiquement.
- Les médias de signalement citoyen et les vidéos de résolution sont deux catégories distinctes avec des autorisations distinctes.
- La mairie ne doit voir que les signalements correspondant à sa localité et les circuits Nigelec/NDE centraux correspondants.
- Toute modification des règles d'accès doit préserver les contrôles serveur, les RLS et les autorisations existantes.

### Comptes professionnels
- Comptes professionnels concernés : Mairie, Nigelec, NDE, CST et agents terrain, selon les rôles existants.
- Les agences Nigelec/NDE sont créées par les structures centrales via un code d'agence unique, pas par une inscription publique libre.
- Connexion agent terrain avec téléphone et mot de passe.
- La création et la gestion des comptes mairie restent soumises au contrôle CST.
- Le compte CST et son espace sont distincts ; ne pas fusionner les tableaux de bord ni élargir les rôles.
- Sur mobile, l'espace professionnel doit rester adapté aux agents terrain selon les décisions déjà prises.

## 5. Médias et vidéo — décisions actuelles

- Taille maximale de vidéo connue : **100 Mo** (la valeur de 50 Mo est obsolète).
- Aucune limite de durée n'est actuellement souhaitée.
- Formats déjà pris en compte : MP4, WebM et MOV ; vérifier les validations réellement présentes avant toute évolution.
- Ne pas changer le parcours de sélection/capture des médias sans confirmation de l'utilisateur.
- Les originaux restent dans le stockage privé Supabase.
- Les médias non approuvés ne doivent pas être rendus publics, même temporairement.
- Les vidéos de résolution sont gérées séparément et ne doivent pas être confondues avec les vidéos citoyennes.

### État de l'infrastructure vidéo
- Supabase reste le cœur du système : base de données, authentification professionnelle, stockage privé, modération et contrôle d'accès.
- Supabase Edge Functions ne doivent pas être utilisées comme serveur lourd de transcodage FFmpeg.
- L'utilisateur souhaite préparer une future intégration Cloudflare Stream, mais **ne veut pas connecter ni payer le service maintenant**.
- Cloudflare Stream n'est pas encore intégré au PCS.
- Aucun VPS ni serveur FFmpeg de production autogéré n'est prévu dans la décision actuelle.
- Objectif futur : streaming adaptatif HLS/ABR, changement automatique de qualité selon la connexion, sans sélecteur manuel de qualité.
- Cloudflare ne doit recevoir que des dérivés vidéo après approbation/publication ; les originaux restent dans Supabase.
- Les vidéos rejetées, en attente ou dépubliées ne doivent pas devenir accessibles via Cloudflare.
- Les webhooks devront être authentifiés/validés ; les secrets restent côté serveur ; la lecture devra respecter les autorisations existantes.
- Prévoir révocation d'accès et suppression coordonnée des dérivés lorsque la publication est retirée.
- Ne jamais envoyer de vrais médias citoyens à un prestataire externe sans accord explicite.

### Document de préparation Cloudflare déjà présent
- Fichier : `docs/VIDEO_STREAMING_CLOUDFLARE_PLAN.md`.
- Commit de création : `5bfa582e9399a23ffe76aa51c91e79cffd50c690`.
- Lien : https://github.com/benwahab/pcs-658a8cd8/blob/main/docs/VIDEO_STREAMING_CLOUDFLARE_PLAN.md
- Ce document définit les étapes futures, les garde-fous de sécurité et le déploiement progressif.
- Ne pas lancer cette intégration ni connecter un compte payant sans nouvelle demande et approbation explicite.

## 6. Repères techniques à auditer avant tout changement média

Ces éléments ont été relevés lors d'audits précédents ; ils doivent être revérifiés dans le code actuel avant toute intervention :
- Bucket Supabase `report-media` privé.
- Service frontend précédemment repéré : `src/pcs/services/media.ts`.
- Fonction Edge précédemment repérée : `public-report-media-url`, avec vérification des métadonnées média, du rôle, du statut de modération et de la publication du rapport avant création d'une URL signée.
- Composant précédemment repéré : `MediaCarousel.tsx`, utilisant la lecture vidéo native et les URL des fichiers originaux ; pas de pipeline HLS/hls.js intégré à ce stade de l'audit.
- Fonction de modération précédemment repérée : `cst-media-moderation`, utilisant les autorisations CST/modérateur régional et la logique serveur de modération.
- Un incident antérieur de lecture avait montré des requêtes HTTP Range échouant avec InvalidJWT/URL signée expirée. Ne pas présumer que le problème est encore présent ; reproduire et diagnostiquer avant d'agir.

## 7. Interface, navigation et identité visuelle

- Identité visuelle : tons sombres, violet/prune et lavande selon les écrans et décisions déjà prises ; respecter le logo officiel PCS.
- Ne pas réintroduire d'anciens logos ou icônes.
- Les textes de l'accueil concernés par le dernier changement doivent rester blancs et lisibles.
- Ne pas appliquer une règle globale de texte blanc à toutes les pages : la modification récente est volontairement limitée à l'introduction de l'accueil.
- Les textes et boutons doivent rester lisibles sur téléphone.
- Éviter les éléments fixes qui bloquent le défilement ou masquent les actions principales.
- Le comportement du menu professionnel, du splash screen et de la navigation mobile a fait l'objet de réglages précis antérieurs : ne pas les modifier sans demande explicite.
- L'utilisateur a signalé dans le passé un écran violet suivi d'un gel ; si cela revient, diagnostiquer les logs et le chargement avant de toucher au splash ou à la navigation.

## 8. Historique de sécurité et qualité à préserver

- Des travaux antérieurs ont durci des Edge Functions sensibles, notamment `mairie-create-agent`, `agent-login` et `mairie-signup`.
- Plusieurs composants et dépendances inutilisés ont été supprimés lors d'un audit antérieur. Ne pas les réintroduire.
- Ne pas réintroduire de services d'authentification obsolètes, de fonctions mortes, de données mock ou de chemins de secours non sécurisés.
- Ne pas supprimer des tables, des données ou des fonctions sans audit de dépendances et accord explicite.
- Ne pas faire de migration de schéma « au cas où ».

## 9. Méthode obligatoire pour chaque prochaine tâche

1. Reformuler précisément l'objectif et les limites de la demande.
2. Identifier le dépôt, le fichier, le composant, la fonction ou la table réellement concernés.
3. Lire le code actuel sur `main` ; ne pas se fier à un ancien extrait ou à un ancien résumé si le fichier peut avoir changé.
4. Pour Supabase, lire d'abord la compétence Supabase et auditer les tables, RLS, fonctions et appels concernés.
5. Établir les risques de régression sur les flux citoyens, professionnels, médias et modération.
6. Effectuer la plus petite modification possible sur `main`.
7. Vérifier le diff et le commit créé.
8. Contrôler le CI GitHub jusqu'à un état final ; si le run est en cours, le dire et continuer à vérifier avant de déclarer le résultat.
9. Vérifier que Lovable a chargé le SHA exact du dernier commit et que le projet est prêt.
10. Indiquer clairement ce qui a changé, ce qui n'a pas changé, les vérifications faites et les éventuelles limites.
11. Si un contrôle échoue, ne pas le masquer : diagnostiquer et corriger seulement dans le périmètre autorisé.

## 10. Instruction à copier au début de la prochaine discussion

« Nous reprenons le projet PCS — Plateforme citoyenne de signalement exactement au point de sauvegarde du 31 octobre 2026. Commence par lire intégralement le document `docs/POINT_DE_REPRISE_PCS_2026-10-31.md` dans le dépôt `benwahab/pcs-658a8cd8`, branche `main`, puis vérifie l'état réel du dépôt, le dernier commit, le CI et la synchronisation Lovable avant toute nouvelle modification. Respecte toutes les consignes du document. Travaille uniquement sur ce dépôt et sur `main`, sans créer de branche. Ne touche pas à Coup Sûr. Fais un audit avant toute modification, ne change que ce que je demande, protège les flux existants, et ne prétends jamais qu'une vérification est réussie sans preuve. Le dernier changement concerne les textes de l'accueil remis en blanc, commit `279c4bcd3e10cf1b36797005e368402bf9176e7d`, CI run 853 réussi et Lovable synchronisé. »

---

**Fin du point de sauvegarde.** Toute nouvelle information ou décision ultérieure doit être ajoutée au prochain point de reprise ; ce document décrit l'état vérifié au 31 octobre 2026.
