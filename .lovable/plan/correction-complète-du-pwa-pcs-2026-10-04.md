# Correction complète du PWA PCS

## Objectif
Fiabiliser uniquement l’expérience PWA de PCS : démarrage, détection réseau, installation, icônes et mise à jour du cache, sans toucher aux parcours métier.

## Correctifs prévus
1. **Écran de démarrage**
   - Utiliser le logo PCS officiel depuis un fichier public permanent et vérifié.
   - Centraliser le comportement de démarrage pour supprimer les deux écrans concurrents actuels.
   - Garder le logo affiché pendant l’absence de réseau ; afficher le cercle violet uniquement après un échec de connexion.
   - Dès le retour du réseau, retirer immédiatement le cercle et conserver le logo seul pendant exactement 5 secondes avant l’accueil.

2. **Installation**
   - Capturer l’événement natif d’installation assez tôt pour ne pas le perdre avant le chargement de l’interface.
   - Afficher la proposition uniquement après la visite guidée, uniquement si le navigateur autorise l’installation et si PCS n’est pas déjà installé.
   - Conserver l’action native directe et limiter « Plus tard » à la session courante.

3. **Manifeste et icônes**
   - Générer de vraies icônes PNG carrées 192 px et 512 px à partir du logo officiel, avec variantes compatibles `any` et `maskable`.
   - Aligner le manifeste, le favicon et l’icône Apple sur ces fichiers publics.

4. **Cache et service worker**
   - Remplacer le service worker écrit à la main par la configuration PWA prise en charge par le projet, avec navigation en priorité réseau et ressources versionnées en cache.
   - Empêcher son enregistrement dans l’éditeur, les aperçus Lovable et le développement.
   - Prévoir la suppression sûre de l’ancien cache PCS lors de la transition, sans toucher aux données ni aux autres fonctionnalités.

## Vérifications
- Vérifier la compilation, les types et les erreurs de l’aperçu.
- Tester le lancement en connexion normale, hors connexion puis retour en ligne, avec mesure du délai de 5 secondes.
- Tester l’événement d’installation, « Plus tard », l’état déjà installé, le manifeste, les icônes et les URL publiques sur un format téléphone.
- Publier les corrections, vérifier le site publié et confirmer la révision effectivement chargée.

## Limite de validation
Le dialogue final d’installation appartient au navigateur et ne peut être automatisé entièrement. Le bouton PCS, l’événement natif et les états installable/déjà installé seront néanmoins vérifiés en environnement téléphone simulé, puis contrôlés sur le site publié.
