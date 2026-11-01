# PCS — POINT DE REPRISE INTÉGRAL ET CONSIGNES PERMANENTES
**Dernière mise à jour : 1er novembre 2026**  
**But : reprendre dans une nouvelle discussion exactement à l'état vérifié ci-dessous, sans réintroduire d'anciennes décisions ni toucher à ce qui fonctionne.**

---

## 1. IDENTITÉ DU PROJET — À RESPECTER SANS EXCEPTION

- Produit : **PCS — Plateforme citoyenne de signalement**.
- Dépôt GitHub unique : `benwahab/pcs-658a8cd8`.
- Branche unique : **`main`**.
- Projet Supabase PCS : `rqraxjypjwsxcmjdwroy`.
- Projet Lovable PCS : `1de9a97f-0ae5-43ff-aaa0-90099116a7ec`.
- Workspace Lovable : `Vcg9GCLRh00H9LjLBn1o`.
- Éditeur : https://lovable.dev/projects/1de9a97f-0ae5-43ff-aaa0-90099116a7ec
- Aperçu : https://id-preview--1de9a97f-0ae5-43ff-aaa0-90099116a7ec.lovable.app

**Ne jamais confondre PCS avec Coup Sûr.** Coup Sûr est un projet séparé avec son propre dépôt et son propre Supabase (`gisjxogimycghgkxedif`). Pour une tâche PCS, ne jamais lire, modifier ou déployer dans Coup Sûr.

## 2. RÈGLES DE TRAVAIL IMPÉRATIVES

1. Travailler directement dans le dépôt GitHub PCS ci-dessus, exclusivement sur `main`.
2. **Ne jamais créer de branche**, même temporaire, de test, de sauvegarde ou de correction.
3. Ne jamais utiliser l'ancien dépôt `benwahab/PCS`, une copie locale ancienne ou un autre projet Lovable.
4. Avant chaque changement, faire un audit ciblé du code actuel et de ses dépendances sur `main`. Les fichiers actuels priment toujours sur les souvenirs et anciens résumés.
5. Faire uniquement le changement explicitement demandé. Aucun nettoyage, refactor, redesign, migration ou amélioration opportuniste.
6. Préserver strictement les données de production, comptes, signalements, médias, autorisations, politiques RLS, stockage, fonctions Edge et parcours existants.
7. Ne jamais créer de données fictives, comptes de démonstration, statistiques simulées ou raccourcis de sécurité.
8. Ne jamais annoncer qu'un test, CI, déploiement, synchronisation ou changement a réussi sans résultat vérifiable.
9. Après une modification de code : vérifier le commit sur `main`, le CI jusqu'à son état final et la synchronisation Lovable avec le SHA exact du commit.
10. Si le CI est en cours, continuer à le vérifier ; ne pas le déclarer réussi prématurément.
11. Pour toute tâche Supabase, lire d'abord la compétence Supabase installée, puis inspecter le schéma, fonctions, RLS, triggers et dépendances concernés.
12. Aucune dépense, service payant, migration risquée, suppression de données ou changement hors périmètre sans autorisation explicite.
13. Si une décision produit est ambiguë et peut changer le comportement, poser une seule question claire avant d'agir.
14. L'utilisateur attend l'exécution réelle et les contrôles, pas seulement un prompt ou des instructions à copier.
15. Lorsqu'il demande « sans rien modifier », rester strictement en lecture seule : aucune écriture GitHub, SQL, déploiement ou changement Lovable.

## 3. ÉTAT GIT / CI / LOVABLE AU MOMENT DE CETTE SAUVEGARDE

### Dernier état vérifié sur GitHub
- Branche : `main`.
- Dernier commit observé : `c822ef5fe3642f8716c4d7184349069d9430ceb9`.
- Message : `Queue deleted mairie accounts for CST reapproval`.
- Commit précédent : `b31dead8889f54d740e89de898ac138506195237` — `Allow safe mairie account replacement on existing locality`.
- Historique visible juste avant : `bb2c51f8c9a68a313081f4f6a8a123141fd16d1f`, puis `cff69b2d3e14e494e197a4923de13b03ebb39910`.
- Dernier commit : https://github.com/benwahab/pcs-658a8cd8/commit/c822ef5fe3642f8716c4d7184349069d9430ceb9

### CI
- Run CI du dernier commit : **877**, ID `41315387875`.
- SHA testé : `c822ef5fe3642f8716c4d7184349069d9430ceb9`.
- État : `completed`.
- Conclusion : **success**.
- URL : https://github.com/benwahab/pcs-658a8cd8/actions/runs/41315387875
- Le run 876 du commit précédent `b31dead...` était également terminé avec succès.
- Ce statut concerne le code avant l'ajout du présent point de sauvegarde. Après le commit de ce document, vérifier le nouveau run CI déclenché par cette mise à jour.

### Lovable
- Projet vérifié le 1er novembre 2026.
- `latest_commit_sha` = `c822ef5fe3642f8716c4d7184349069d9430ceb9`.
- Projet `ready`, `agentFinished=true`, aucune erreur signalée.
- Cela confirme la synchronisation du code avant le présent commit documentaire. Re-vérifier après ce commit.
- Ne pas demander à Lovable de modifier le code : les changements de code sont faits directement dans GitHub. Lovable sert à vérifier la synchronisation et l'aperçu.

## 4. DERNIÈRE DEMANDE ET AUDIT CAMÉRA — POINT TRÈS IMPORTANT

### Décision produit définitive à respecter
**La fonctionnalité de capture directe avec la caméra du téléphone a été abandonnée et l'utilisateur a demandé qu'elle soit complètement supprimée. Ne jamais la réintroduire.**

Le parcours attendu est la **sélection / importation de fichiers déjà présents sur le téléphone** :
- choisir une photo depuis les fichiers ou la galerie du téléphone ;
- choisir une vidéo déjà présente sur le téléphone ;
- ne pas ouvrir directement l'appareil photo depuis PCS ;
- ne pas enregistrer une vidéo en direct depuis PCS ;
- ne pas proposer de bouton « prendre une photo », « filmer », « ouvrir la caméra » ou équivalent.

### Audit en lecture seule effectué le 1er novembre 2026
L'utilisateur a demandé que tout ce qui concerne la capture caméra soit complètement supprimé sans rien modifier. L'audit a été fait sans aucune écriture ni changement du projet.

Résultats des vérifications :
- recherches dans GitHub pour `getUserMedia`, `MediaRecorder`, `capture environment`, `capture user`, `videoStream`, `navigator.mediaDevices` et `camera` : aucun résultat de code correspondant n'a été retourné ;
- fichiers lus directement sur `main` : `src/pcs/pages/ReportForm.tsx`, `src/pcs/services/media.ts`, `src/pcs/pages/AgentTerrain.tsx`, `src/pcs/pages/MairieDashboard.tsx`, `src/pcs/pages/Moderation.tsx`, `src/pcs/pages/CST.tsx`, `src/pcs/components/MediaCarousel.tsx`, `src/pcs/router.tsx`, `src/routes/signaler.tsx`, `src/routes/signalement.$id.tsx`, `supabase/edge-functions-source/citizen-report-submit/index.ts`, `src/pcs/lib/reports.ts`, documentation technique et README PCS ;
- aucun appel `getUserMedia`, aucun mécanisme caméra `MediaRecorder`, aucun `navigator.mediaDevices`, aucun `facingMode`, aucune API `ImageCapture` et aucun attribut HTML `capture` n'a été trouvé dans les principaux fichiers fonctionnels examinés ;
- `ReportForm.tsx` ne présente pas de mécanisme de capture caméra dans les lignes examinées ;
- des occurrences isolées de « capture » concernent des événements tactiles, les coordonnées GPS ou des commentaires techniques, pas l'ouverture de la caméra.

**Conclusion prudente :** aucune fonctionnalité active de capture directe caméra n'a été identifiée dans les fichiers examinés. L'importation de médias depuis le téléphone est conservée. L'audit n'a pas prouvé par une analyse exhaustive automatisée de chacun des 325 fichiers que toutes les mentions documentaires ou historiques du mot caméra ont disparu. Ne pas prétendre le contraire. Si l'utilisateur demande une preuve exhaustive, faire une recherche complète sur tout le dépôt et distinguer code exécutable, documentation et historique.

### Ce qui n'a PAS été fait
- Aucun fichier de code modifié.
- Aucun commit de code créé.
- Aucune migration ni requête SQL d'écriture.
- Aucun compte, signalement, média ou donnée de production modifié.
- Aucun changement Lovable.
- Aucune suppression hasardeuse de mots « capture » ayant un autre sens.

**Ne pas reprendre une ancienne consigne de capture caméra.** En cas de doute, cette section est la référence actuelle et prévaut sur les anciens souvenirs.

## 5. DERNIÈRES MODIFICATIONS FONCTIONNELLES — COMPTES MAIRIE

### Règle métier confirmée par l'utilisateur
- Une localité déjà enregistrée ne doit pas pouvoir être enregistrée une deuxième fois comme une nouvelle localité.
- Si le compte mairie associé à une localité est supprimé par le CST, la localité et ses données doivent rester.
- Un nouveau compte mairie peut ensuite être créé pour cette même localité.
- Le nouveau compte doit être rattaché à la même ligne mairie existante, conserver l'identifiant de la localité et retrouver les données qui y sont rattachées.
- Le nouveau compte doit rester inactif / en attente d'approbation CST selon le flux prévu.
- Le bouton CST « Supprimer définitivement le compte » existait déjà : ne pas ajouter un deuxième bouton ni refaire cette interface.

### Changements déjà commités sur main
- Commit `bb2c51f8c9a68a313081f4f6a8a123141fd16d1f` : ajustements UI CST antérieurs.
- Commit `b31dead8889f54d740e89de898ac138506195237` : `Allow safe mairie account replacement on existing locality`.
- Commit `c822ef5fe3642f8716c4d7184349069d9430ceb9` : `Queue deleted mairie accounts for CST reapproval`.
- Les fonctions Edge concernées ont été déployées au cours de ce travail ; versions précédemment observées : `mairie-signup` version 9 et `cst-auth` version 6. Re-vérifier les versions actuelles avant toute action.
- CI des commits b31dead et c822ef5 : succès.
- Lovable était synchronisé sur c822ef5 au moment du contrôle.

### Protection des données
La suppression du compte utilisateur ne doit pas supprimer la localité ni ses signalements, médias, historique ou autres données métier attachées. Ne jamais tester cette logique en supprimant un vrai compte mairie ou une vraie localité sans demande explicite et procédure de test sûre.

## 6. FONCTIONNEMENT CITOYEN ET MODÉRATION — EXIGENCES À PRÉSERVER

- PCS est une PWA nationale pour le Niger, pensée pour les téléphones et les connexions parfois faibles.
- Les citoyens peuvent signaler sans créer de compte et sans se connecter.
- Les médias non approuvés ne doivent jamais apparaître dans le flux public d'accueil ni dans l'espace mairie.
- Seuls les médias approuvés selon le circuit de modération peuvent être publiés.
- Si un signalement n'a pas de vidéo, une photo est requise.
- Le bouton de confirmation citoyenne est « Je confirme », pas « J'aime ».
- Les commentaires sont facultatifs ; ouverture/fermeture sans forcer l'utilisateur à commenter.
- Les statuts de suivi doivent rester visibles, notamment « en cours de vérification », « prise en charge » et « résolu ».
- Après envoi d'un signalement, le remerciement dure 3 secondes puis retour au contexte d'origine (accueil ou vidéo).
- Le contenu vidéo doit se charger rapidement, occuper correctement l'écran sans bandes noires et éviter l'image partiellement chargée.
- Préserver la lecture sur réseau faible.
- Les indices de défilement ne doivent pas bloquer ou masquer le bouton Signaler.
- CST contrôle tous les signalements tant qu'aucun modérateur régional n'est assigné.
- Lorsqu'un modérateur régional est assigné, il traite les signalements de sa région selon les droits attribués ; le CST peut retirer cet accès et reprendre le contrôle.
- Aucun média en attente ou rejeté ne doit être rendu public.
- Les vidéos de résolution sont distinctes des médias initiaux du signalement et ont leurs propres règles d'accès.
- Les mairies ne doivent voir que les signalements de leur localité.
- Les circuits Nigelec et NDE doivent respecter le routage localité/structure centrale déjà défini.
- Toute modification des permissions doit conserver les contrôles serveur et RLS.

## 7. MÉDIAS ET VIDÉOS — PARAMÈTRES À NE PAS CONFONDRE

- Taille maximale vidéo connue : **100 Mo**. La limite de 50 Mo est obsolète.
- Formats pris en compte dans le code examiné : MP4, WebM et QuickTime/MOV ; toujours revérifier le code avant changement.
- Les médias sont sélectionnés/importés depuis le téléphone ; pas de capture directe par caméra.
- Le bucket de stockage média Supabase est privé.
- Les médias en attente, rejetés ou dépubliés ne doivent pas devenir publiquement accessibles.
- Les originaux restent dans Supabase.
- Ne pas inventer ou imposer une limite de durée vidéo. Le point de reprise précédent indiquait qu'aucune limite de durée n'était souhaitée ; le code Edge examiné ne valide pas une durée maximale côté serveur. Si une demande ultérieure change cette règle, clarifier avec l'utilisateur avant de modifier.
- Les vidéos de résolution suivent un circuit distinct et ne doivent pas être mélangées aux vidéos citoyennes.

## 8. CLOUDFLARE STREAM — PRÉPARATION FUTURE UNIQUEMENT

- Supabase reste le cœur : base, authentification professionnelle, stockage privé, modération et autorisations.
- L'utilisateur veut préparer proprement le terrain pour une future intégration Cloudflare Stream.
- **Ne pas connecter Cloudflare maintenant, ne pas activer de service payant et ne pas lancer l'intégration sans demande et approbation explicites.**
- Pas de serveur FFmpeg lourd dans les Edge Functions Supabase.
- Objectif futur : HLS/ABR adaptatif avec qualité automatique selon le débit, sans sélecteur manuel.
- Les originaux restent dans Supabase ; seuls les dérivés autorisés après approbation/publication pourraient être transmis au service externe.
- Les médias en attente, rejetés ou dépubliés ne doivent jamais être accessibles via Cloudflare.
- Prévoir validation des webhooks, secrets côté serveur, contrôle d'accès à la lecture, révocation et suppression coordonnée des dérivés.
- Ne jamais envoyer de vrais médias citoyens à un prestataire externe sans accord explicite.
- Document de préparation existant : `docs/VIDEO_STREAMING_CLOUDFLARE_PLAN.md`. Le lire avant toute future tâche Cloudflare.

## 9. INTERFACE ET IDENTITÉ VISUELLE

- Respecter le logo PCS officiel et les couleurs sombres/violet/lavande déjà établies.
- Ne pas réintroduire d'anciens logos, icônes ou variantes abandonnées.
- Les textes de l'introduction de l'accueil concernés par la correction du 31 octobre doivent rester blancs et lisibles.
- Ne pas appliquer une règle générale de texte blanc à toutes les pages : la correction d'accueil était ciblée.
- Préserver la lisibilité mobile, le défilement et la visibilité des actions principales.
- Ne pas modifier splash screen, navigation mobile, menu professionnel, connexion ou comportement PWA sans demande explicite.
- Un ancien incident d'écran violet puis gel a été signalé : s'il réapparaît, diagnostiquer précisément le chargement et les logs avant toute modification.

## 10. AUDIT TECHNIQUE — POINTS À REVALIDER AVANT TOUTE CORRECTION

Les points suivants proviennent d'audits antérieurs et ne doivent pas être présentés comme des bugs confirmés sans nouvelle vérification :

1. **Vues SQL publiques** : les vues `public_reports` et `public_report_media` avaient été observées avec `security_invoker` non activé. Examiner les définitions, privilèges, dépendances et comportement RLS avant de conclure à une faille ou de changer leur configuration.
2. **Durée vidéo** : le code `supabase/edge-functions-source/citizen-report-submit/index.ts` contenait un commentaire indiquant que la durée n'était pas limitée ; le point de reprise précédent dit qu'aucune limite de durée n'est souhaitée. Ne pas modifier ce comportement sans nouvelle demande.
3. **Logs** : un ancien relevé avait compté des réponses 401/403 et un seul 500 `cst-auth` daté du 31 octobre 2026 à 16:32:28 UTC. Les 401/403 peuvent être des refus attendus ; ne pas les traiter automatiquement comme incidents. Rechercher des événements récents et corrélés avant de conclure.
4. **Vérification de publication** : toujours contrôler que les médias non approuvés ne sont accessibles ni via les vues, ni via les URL signées, ni via l'accueil, ni via l'espace mairie.
5. **Données observées lors d'un audit précédent** : 7 signalements, 9 médias, 1 mairie, 2 organisations, 18 unités d'organisation, 2 agents terrain, 1 compte CST et 2 demandes d'inscription d'organisation. Ces nombres sont historiques, pas une vérité actuelle ; ne pas les utiliser comme objectifs ni les modifier.

## 11. FICHIERS / ZONES IMPORTANTES

À lire dans leur version actuelle sur `main` avant intervention :
- Formulaire citoyen : `src/pcs/pages/ReportForm.tsx`.
- Service médias : `src/pcs/services/media.ts`.
- Carrousel média : `src/pcs/components/MediaCarousel.tsx`.
- Gestion des signalements : `src/pcs/lib/reports.ts`.
- Fonctions Edge sources : `supabase/edge-functions-source/`.
- Soumission citoyenne : `supabase/edge-functions-source/citizen-report-submit/index.ts`.
- Inscription mairie : `supabase/edge-functions-source/mairie-signup/index.ts`.
- Authentification et opérations CST : `supabase/edge-functions-source/cst-auth/index.ts`.
- Modération : `supabase/edge-functions-source/cst-media-moderation/index.ts`.
- Préparation Cloudflare : `docs/VIDEO_STREAMING_CLOUDFLARE_PLAN.md`.
- Présent point de reprise : `docs/POINT_DE_REPRISE_PCS_2026-10-31.md`.

Ne pas supposer qu'un nom de fichier, un numéro de version ou un comportement historique est encore identique : vérifier le dépôt et Supabase au moment de la tâche.

## 12. PROCÉDURE OBLIGATOIRE À CHAQUE REPRISE

1. Lire intégralement ce document depuis GitHub, branche `main`.
2. Vérifier que le dépôt et la branche sont toujours les bons.
3. Lire le dernier commit et les changements intervenus depuis ce point.
4. Vérifier le CI du dernier commit et son état final.
5. Vérifier dans Lovable que `latest_commit_sha` correspond au dernier SHA GitHub, et que le projet est `ready` / agent terminé.
6. Si une tâche Supabase est demandée, charger la compétence Supabase avant toute lecture ou opération et vérifier que le projet cible est bien `rqraxjypjwsxcmjdwroy`.
7. Résumer en quelques lignes l'état confirmé et les écarts éventuels avant de modifier.
8. Pour une demande de vérification « sans rien modifier », utiliser uniquement des opérations de lecture.
9. Pour une demande de modification, limiter le diff à la portée explicitement demandée.
10. Vérifier le diff, le commit, le CI, la synchronisation Lovable et, si pertinent, le déploiement Edge Function séparément.
11. Ne jamais tester sur des données réelles destructivement ; utiliser un environnement de test autorisé ou une simulation locale sans écriture en production.
12. Rapporter honnêtement ce qui a été vérifié, ce qui ne l'a pas été et ce qui reste incertain.

## 13. TEXTE À ENVOYER AU DÉBUT DE LA PROCHAINE DISCUSSION

« Nous reprenons PCS — Plateforme citoyenne de signalement. Lis intégralement le fichier `docs/POINT_DE_REPRISE_PCS_2026-10-31.md` dans le dépôt privé `benwahab/pcs-658a8cd8`, branche `main`. Ce document est le point de référence le plus récent et contient toutes les consignes. Vérifie l'état réel du dépôt, le dernier commit, le CI et la synchronisation Lovable avant toute modification. Travaille uniquement sur ce dépôt et sur `main`, sans créer de branche et sans toucher à Coup Sûr. Fais un audit avant chaque changement et ne modifie que ce que je demande. Important : la capture directe avec la caméra du téléphone est abandonnée et ne doit jamais être réintroduite ; le citoyen sélectionne/importer des fichiers photo ou vidéo déjà présents sur son téléphone. Le dernier audit caméra a été fait en lecture seule et aucun code n'a été modifié. Protège toutes les données et tous les flux existants, et ne prétends jamais qu'un contrôle est réussi sans preuve. »

---

**Fin du point de reprise — état documenté au 1er novembre 2026.**  
Toute nouvelle décision explicite de l'utilisateur prévaut sur une ancienne règle, et doit être intégrée au prochain point de reprise.