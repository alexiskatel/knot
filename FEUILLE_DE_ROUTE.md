# Feuille de Route - Application Knot

## 1. Vue d'ensemble de l'application

**Knot** est une application mobile de prise de notes collaborative pour les projets d'entreprise qui permettra de :
- Prendre des notes textuelles avec formatage basique
- Joindre des images aux notes
- Organiser les notes par projet
- Commenter les notes (texte, images, notes vocales)
- Réagir aux commentaires
- Fonctionner hors ligne avec synchronisation lors de la connexion
- Utiliser une authentification simplifiée par clé unique
- Support multi-entreprise (multi-tenant) avec espaces de travail isolés

## 2. Architecture technique

### Backend (knot-api)
- **Framework**: Laravel 12
- **Base de données**: SQL (MySQL/PostgreSQL en production, SQLite en développement)
- **Architecture**: API RESTful basée sur BaseApiController
- **Multi-tenant**: Isolation des données par entreprise
- **Authentification**: Système de clé API unique par utilisateur liée à son entreprise

### Frontend (knot-app)
- **Framework**: React Native avec Expo
- **Navigation**: Expo Router
- **Base de données locale**: WatermelonDB (wrapper SQLite optimisé pour React Native)
- **Styling**: StyleSheet avec support de thème (couleur principale: #2F3C73)
- **Gestion d'état**: React Context pour les données globales

## 3. Modèles de données

1. **Entreprise**
   - id
   - nom
   - code_unique (identifiant court pour l'entreprise)
   - logo
   - couleur_primaire (personnalisation visuelle)
   - date de création/modification
   - statut (actif/inactif)

2. **Projet**
   - id
   - titre
   - description
   - couleur
   - date de création/modification
   - statut (actif/archivé)
   - sync_id (identifiant pour la synchronisation)
   - entreprise_id (foreign key - relation avec l'entreprise)

3. **Note**
   - id
   - titre
   - contenu (texte formaté)
   - id_projet (foreign key)
   - date de création/modification
   - statut (brouillon/publié/archivé)
   - auteur_id (foreign key vers users)
   - sync_id (identifiant pour la synchronisation)
   - sync_status (pending/synced)
   - entreprise_id (foreign key - relation avec l'entreprise)

4. **Media**
   - id
   - type (image/audio)
   - chemin
   - chemin_local (stockage local temporaire)
   - model_type (polymorphic - Note ou Commentaire)
   - model_id (polymorphic id)
   - date de création
   - sync_id (identifiant pour la synchronisation)
   - sync_status (pending/synced)
   - entreprise_id (foreign key - relation avec l'entreprise)

5. **Commentaire**
   - id
   - contenu (texte)
   - note_id (foreign key)
   - auteur_id (foreign key vers users)
   - type (texte/audio)
   - date de création/modification
   - sync_id (identifiant pour la synchronisation)
   - sync_status (pending/synced)
   - entreprise_id (foreign key - relation avec l'entreprise)

6. **Réaction**
   - id
   - type (emoji: 👍, ✅, ⚠️, etc.)
   - commentaire_id (foreign key)
   - auteur_id (foreign key vers users)
   - date de création
   - sync_id (identifiant pour la synchronisation)
   - sync_status (pending/synced)
   - entreprise_id (foreign key - relation avec l'entreprise)

7. **User**
   - id
   - nom
   - api_key (clé unique pour l'authentification)
   - statut (actif/inactif)
   - date de création/modification
   - last_sync_date (date de dernière synchronisation)
   - entreprise_id (foreign key - relation avec l'entreprise)

## 4. API Endpoints

Toutes les routes seront préfixées par `/api/v1/` et protégées par authentification API key.

### Entreprises
- `GET /entreprises` - Liste des entreprises (admin seulement)
- `POST /entreprises` - Créer une entreprise (admin seulement)
- `GET /entreprises/{id}` - Détails d'une entreprise
- `PUT /entreprises/{id}` - Modifier une entreprise (admin seulement)
- `POST /entreprises/validate-code` - Valider un code d'entreprise

### Authentification
- `POST /auth/validate-key` - Valider une clé API
- `POST /auth/generate-key` - Générer une nouvelle clé API (admin)
- `POST /auth/{code_entreprise}/generate-key` - Générer une clé pour un utilisateur d'une entreprise spécifique

### Projets
- `GET /projets` - Liste des projets
- `POST /projets` - Créer un projet
- `GET /projets/{id}` - Détails d'un projet
- `PUT /projets/{id}` - Modifier un projet
- `DELETE /projets/{id}` - Supprimer un projet

### Notes
- `GET /notes` - Liste des notes (avec filtrage par projet)
- `POST /notes` - Créer une note
- `GET /notes/{id}` - Détails d'une note
- `PUT /notes/{id}` - Modifier une note
- `DELETE /notes/{id}` - Supprimer une note
- `POST /notes/{id}/media` - Ajouter une image à une note

### Commentaires
- `GET /notes/{id}/commentaires` - Liste des commentaires d'une note
- `POST /notes/{id}/commentaires` - Ajouter un commentaire
- `PUT /commentaires/{id}` - Modifier un commentaire
- `DELETE /commentaires/{id}` - Supprimer un commentaire
- `POST /commentaires/{id}/media` - Ajouter un média à un commentaire

### Réactions
- `POST /commentaires/{id}/reactions` - Ajouter une réaction
- `DELETE /commentaires/{id}/reactions/{id}` - Supprimer une réaction

### Synchronisation
- `POST /sync` - Point d'entrée pour la synchronisation bidirectionnelle
- `GET /sync/status` - Vérifier le statut de la synchronisation
- `POST /sync/{entreprise_id}` - Synchronisation spécifique à une entreprise

## 5. Écrans de l'application

1. **Écran d'initialisation**
   - Écran de bienvenue pour les nouveaux utilisateurs
   - Champ de saisie du code entreprise
   - Champ de saisie de la clé API utilisateur
   - Option de scan QR code pour la clé API et le code entreprise

2. **Liste des notes** (écran d'accueil)
   - Sélecteur de projet horizontal (tous les projets par défaut)
   - Liste verticale des notes sous forme de cartes
   - Bouton + flottant pour ajouter une note
   - Indication visuelle du projet sur chaque carte
   - Pull-to-refresh pour actualiser
   - Indicateur de statut de synchronisation

3. **Création/Édition de note**
   - Sélecteur de projet
   - Champ titre
   - Éditeur de texte avec options de formatage basiques
   - Interface d'upload d'images
   - Boutons Annuler/Enregistrer
   - Option de sauvegarde automatique en brouillon

4. **Visualisation de note**
   - Affichage du contenu formaté de la note
   - Indication du projet et de l'auteur
   - Bouton d'édition dans le coin supérieur
   - Bouton pour afficher/masquer les commentaires
   - Panneau latéral des commentaires
   - Indicateur de statut hors ligne/en ligne

5. **Panneau de commentaires**
   - Liste défilante des commentaires
   - Formulaire d'ajout de commentaire en bas
   - Support pour texte, images et audio
   - Boutons de réaction sur chaque commentaire
   - Indicateurs de statut de synchronisation pour chaque commentaire

6. **Paramètres**
   - Affichage de la clé API (masquée par défaut)
   - Affichage du code entreprise
   - Option de forcer la synchronisation
   - Information sur le stockage utilisé
   - Option de purge des données locales
   - Préférences d'affichage
   - Option de déconnexion (changement d'entreprise)

## 6. Stratégie de synchronisation

### Architecture de synchronisation

1. **Base de données locale**
   - WatermelonDB comme wrapper SQLite optimisé pour React Native
   - Schéma local correspondant aux modèles de données
   - Mécanisme de suivi des modifications avec sync_id et sync_status

2. **Mécanisme de synchronisation**
   - Synchronisation bidirectionnelle (pull/push)
   - Gestion des conflits basée sur les timestamps
   - File d'attente des opérations pour la synchronisation différée
   - Priorité pour les données essentielles

3. **Stratégie de mise en cache**
   - Mise en cache des images avec stockage local
   - Chargement différé des médias volumineux
   - Préchargement intelligent basé sur l'usage
   - Isolation des données par entreprise dans la base locale

### Processus de synchronisation

1. **Au lancement de l'application**
   - Vérification des données non synchronisées
   - Synchronisation automatique si connexion disponible

2. **Pendant l'utilisation**
   - Suivi des modifications avec marqueurs (sync_status)
   - Synchronisation en arrière-plan lors des modifications

3. **Perte de connexion**
   - Stockage local de toutes les modifications
   - Mise en file d'attente des opérations de synchronisation
   - Notification visuelle du statut hors ligne

4. **Reconnexion**
   - Détection automatique du retour de la connexion
   - Synchronisation des modifications en attente
   - Résolution des conflits selon les règles définies

## 7. Composants réutilisables à développer

1. **ProjectSelector**
   - Liste horizontale défilante des projets
   - Indicateur de sélection
   - Support de filtrage

2. **NoteCard**
   - Aperçu du titre et contenu
   - Indicateur de projet (couleur)
   - Métadonnées (date, auteur)
   - Indicateur de statut de synchronisation

3. **TextEditor**
   - Champ de texte avec formatage
   - Barre d'outils de formatage
   - Support pour insérer des images
   - Sauvegarde automatique en local

4. **MediaUploader**
   - Sélection d'image depuis la galerie/appareil photo
   - Prévisualisation
   - Barre de progression
   - Stockage local temporaire avant synchronisation

5. **CommentPanel**
   - Tiroir latéral pour les commentaires
   - Liste de commentaires avec pagination
   - Formulaire d'ajout de commentaire
   - Gestion du statut de synchronisation

6. **CommentItem**
   - Affichage du contenu (texte/image/audio)
   - Boutons de réaction
   - Métadonnées (auteur, date)
   - Indicateur de statut de synchronisation

7. **AudioRecorder**
   - Interface d'enregistrement audio
   - Contrôles lecture/pause/stop
   - Indicateur de durée
   - Compression et stockage local

8. **SyncIndicator**
   - Affichage visuel du statut de synchronisation
   - Animation lors de la synchronisation en cours
   - Indication des éléments en attente de synchronisation

9. **OfflineManager**
   - Détection du statut de connexion
   - Gestion de la file d'attente de synchronisation
   - Résolution des conflits

10. **EnterpriseSelector**
   - Interface de sélection d'entreprise
   - Validation du code entreprise
   - Gestion des erreurs d'authentification

## 8. Plan de développement

### Phase 1: Configuration de base
1. Configurer le projet backend Laravel avec les migrations
2. Mettre en place le projet React Native avec Expo
3. Configurer WatermelonDB pour la base de données locale
4. Implémenter le système d'authentification par clé API
5. Configurer l'architecture multi-tenant avec isolation des données par entreprise
6. Créer les entreprises et utilisateurs de test manuellement dans la base de données

### Phase 2: Backend API
1. Créer les modèles et relations dans Laravel, y compris le modèle Entreprise
2. Implémenter les contrôleurs API en étendant BaseApiController
3. Configurer les routes API avec authentification par clé API
4. Développer l'API de synchronisation avec support multi-tenant
5. Implémenter les filtres de scope par entreprise dans BaseApiController
6. Créer les seeders pour données de test (projets, notes, commentaires)

### Phase 3: Frontend - Structure de base
1. Configurer l'architecture des dossiers React Native
2. Mettre en place le système de navigation avec Expo Router
3. Configurer WatermelonDB avec les schémas de modèles incluant l'isolation par entreprise
4. Implémenter le mécanisme de synchronisation multi-tenant
5. Développer le système d'authentification par clé API avec sélection d'entreprise
6. Créer le composant EnterpriseSelector pour la validation du code entreprise

### Phase 4: Frontend - Écrans principaux
1. Implémenter l'écran d'initialisation avec saisie du code entreprise et de la clé API
2. Développer l'écran de liste des notes avec filtrage par projet (cartes colorées horizontales)
3. Créer l'écran de création/édition de note
4. Implémenter l'écran de visualisation de note
5. Développer le panneau de commentaires
6. Créer l'écran de paramètres avec option de changement d'entreprise
7. Implémenter l'écran de création/gestion des projets

### Phase 5: Fonctionnalités avancées
1. Ajouter le support du formatage de texte
2. Implémenter l'upload et l'affichage des images avec stockage local
3. Développer l'enregistrement et la lecture audio pour les commentaires
4. Intégrer le système de réactions
5. Finaliser le mécanisme de synchronisation avec gestion des conflits

### Phase 6: Finalisation
1. Optimiser les performances
2. Ajouter des animations et transitions
3. Polir l'UI/UX selon les templates fournis
4. Tests et corrections de bugs
5. Documentation

### Phase Ultérieure (post-MVP)
1. Développer l'interface d'administration web pour la gestion des entreprises
2. Créer le module de gestion des utilisateurs et des clés API
3. Implémenter les statistiques et tableaux de bord administrateur
4. Ajouter des fonctionnalités de gestion avancées (quotas, permissions)

## 9. Choix techniques justifiés

### WatermelonDB pour la base de données locale

Nous avons choisi WatermelonDB comme wrapper SQLite pour plusieurs raisons :
- Performance optimisée pour React Native
- Support complet de l'observabilité pour des interfaces réactives
- Gestion efficace de la synchronisation
- Architecture adaptée aux applications avec beaucoup de données
- Support pour les requêtes complexes
- Communauté active et documentation complète

### Architecture offline-first

L'architecture offline-first a été choisie pour :
- Garantir l'utilisabilité de l'application sans connexion
- Offrir une expérience utilisateur fluide même avec une connexion instable
- Permettre l'utilisation de l'application dans des environnements variés
- Optimiser la performance en évitant les requêtes réseau constantes

### Authentification par clé API unique

Le choix d'une authentification par clé API unique (sans login/mot de passe) offre :
- Simplicité d'utilisation (configuration unique)
- Sécurité adaptée aux besoins de l'application
- Évite la complexité de gestion des sessions
- Compatible avec l'usage en entreprise (déploiement facilité)

## 10. Bonnes pratiques à suivre

1. **Structure de code**
   - Séparation des préoccupations (components, hooks, services)
   - Nommage cohérent des fichiers et fonctions
   - Composants petits et à responsabilité unique

2. **Performance**
   - Mémoïsation des composants avec React.memo
   - Utilisation de useMemo/useCallback pour les fonctions et valeurs
   - Optimisation du rendu avec des listes virtualisées
   - Chargement différé des médias

3. **Réutilisation**
   - Extraction des logiques communes dans des hooks
   - Création de composants génériques
   - Utilisation de contexte pour l'état global

4. **Gestion des données**
   - Validation des entrées côté client et serveur
   - Sanitisation des contenus
   - Stratégie claire pour la gestion des erreurs
   - Mécanismes de retry pour les opérations importantes

5. **Synchronisation**
   - Marquage clair des éléments non synchronisés
   - Résolution intelligente des conflits
   - Optimisation de la bande passante avec des synchronisations différentielles
   - Prioritisation des données critiques

6. **Sécurité**
   - Stockage sécurisé de la clé API (Keychain/Keystore)
   - Protection des données sensibles
   - Validation des autorisations
   - Limitation des requêtes API
   - Isolation des données par entreprise

7. **Multi-tenant**
   - Application cohérente des scopes entreprise dans toutes les requêtes
   - Isolation complète des données entre entreprises
   - Validation rigoureuse des permissions et appartenances
   - Personnalisation visuelle par entreprise (logos, couleurs)
   - Gestion des espaces de stockage séparés