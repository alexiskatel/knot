# Pages et Parcours Utilisateurs - Application Knot

## Pages de l'application

### 1. Page de bienvenue et authentification
- **Description** : Page d'accueil pour les nouveaux utilisateurs ou lors d'un changement d'entreprise
- **Éléments** :
  - Logo de l'application
  - Champ de saisie du code entreprise
  - Bouton pour scanner un QR code (contenant le code entreprise)
  - Champ de saisie de la clé API (après validation du code entreprise)
  - Bouton de connexion
  - Messages d'erreur pour code/clé invalide
- **États** :
  - Initial (première utilisation)
  - Reconnexion (changement d'entreprise)
  - Validation en cours
  - Erreur de validation

### 2. Page d'accueil - Liste des notes
- **Description** : Page principale affichant toutes les notes disponibles
- **Éléments** :
  - Barre de navigation avec titre de l'application et nom de l'entreprise
  - Sélecteur horizontal de projets sous forme de cartes colorées avec fond distinct (pas de simples onglets)
  - Liste verticale défilante des notes sous forme de cartes
  - Bouton flottant d'ajout de note (+)
  - Indicateur de statut de synchronisation
  - Barre de recherche
  - Menu latéral/onglets de navigation
- **États** :
  - Chargement initial
  - Affichage normal
  - Filtré par projet
  - Recherche active
  - Hors ligne (données locales)
  - Synchronisation en cours

### 3. Page de création/édition de note
- **Description** : Interface pour créer une nouvelle note ou modifier une note existante
- **Éléments** :
  - Barre d'outils supérieure (annuler, enregistrer)
  - Champ de titre
  - Sélecteur de projet
  - Éditeur de texte riche avec barre d'outils de formatage
  - Options d'insertion d'images
  - Bouton pour prendre une photo
  - Option de sauvegarde automatique
  - Indicateur de statut (brouillon, publié)
- **États** :
  - Création (nouveau)
  - Édition (existant)
  - Sauvegarde en cours
  - Sauvegarde réussie
  - Erreur de sauvegarde

### 4. Page de visualisation de note
- **Description** : Affichage détaillé d'une note en mode lecture
- **Éléments** :
  - Titre et métadonnées (auteur, date, projet)
  - Contenu formaté de la note avec images
  - Bouton d'édition
  - Bouton pour afficher/masquer les commentaires
  - Indicateur du nombre de commentaires
  - Option de partage (si implémentée)
- **États** :
  - Lecture seule
  - Avec panneau de commentaires ouvert/fermé
  - En cours de chargement
  - Hors ligne

### 5. Panneau de commentaires
- **Description** : Tiroir latéral ou section inférieure pour les commentaires d'une note
- **Éléments** :
  - Liste défilante des commentaires
  - Informations d'auteur et horodatage pour chaque commentaire
  - Contenu du commentaire (texte, image ou audio)
  - Boutons de réaction pour chaque commentaire
  - Formulaire d'ajout de commentaire
  - Boutons pour joindre média/enregistrer audio
- **États** :
  - Liste vide (pas de commentaires)
  - Affichage normal
  - Ajout de commentaire en cours
  - Enregistrement audio en cours
  - Chargement de médias
  - Erreur d'envoi

### 6. Page de paramètres
- **Description** : Configuration de l'application et informations utilisateur
- **Éléments** :
  - Informations utilisateur
  - Affichage sécurisé de la clé API
  - Affichage du code entreprise
  - Options de synchronisation manuelle
  - Informations de stockage
  - Option de déconnexion (changement d'entreprise)
  - À propos de l'application
- **États** :
  - Affichage normal
  - Synchronisation forcée en cours
  - Confirmation de déconnexion

### 7. Page de gestion des projets
- **Description** : Interface pour gérer les projets disponibles (tous les utilisateurs peuvent créer des projets par défaut)
- **Éléments** :
  - Liste des projets existants
  - Formulaire d'ajout de projet
  - Options d'édition/suppression de projet
  - Sélecteur de couleur pour les projets
  - Statut du projet (actif/archivé)
- **États** :
  - Liste des projets
  - Ajout de projet
  - Édition de projet
  - Confirmation de suppression

## Parcours utilisateurs (User Stories)

### 1. Première connexion à l'application
1. L'utilisateur installe et ouvre l'application pour la première fois
2. L'application affiche la page de bienvenue
3. L'utilisateur saisit le code de son entreprise (ou scanne un QR code)
4. Après validation, l'utilisateur saisit sa clé API unique
5. L'application vérifie la clé et télécharge les données initiales
6. L'utilisateur est redirigé vers la page d'accueil avec la liste des notes

### 2. Consultation des notes existantes
1. L'utilisateur ouvre l'application (déjà authentifié)
2. L'application affiche la liste des notes de tous les projets
3. L'utilisateur peut faire défiler la liste et voir les aperçus
4. L'utilisateur peut filtrer les notes en sélectionnant un projet spécifique
5. L'utilisateur tape sur une note pour l'ouvrir en mode lecture

### 3. Création d'une nouvelle note
1. Sur la page d'accueil, l'utilisateur appuie sur le bouton + flottant
2. L'application ouvre la page de création de note
3. L'utilisateur sélectionne un projet pour la note
4. L'utilisateur saisit un titre et le contenu avec formatage
5. L'utilisateur peut ajouter des images depuis la galerie ou l'appareil photo
6. L'utilisateur enregistre la note
7. L'application retourne à la liste des notes avec la nouvelle note visible

### 4. Ajout d'un commentaire à une note
1. L'utilisateur ouvre une note en mode lecture
2. L'utilisateur appuie sur le bouton des commentaires pour ouvrir le panneau
3. L'utilisateur voit les commentaires existants avec leurs réactions
4. L'utilisateur utilise le formulaire pour ajouter un nouveau commentaire (texte)
5. Alternativement, l'utilisateur peut enregistrer un commentaire audio
6. Le nouveau commentaire apparaît dans la liste des commentaires

### 5. Réaction à un commentaire
1. Dans le panneau des commentaires, l'utilisateur voit un commentaire
2. L'utilisateur appuie sur un des boutons de réaction disponibles (👍, ✅, ⚠️, etc.)
3. La réaction est enregistrée et le compteur de cette réaction est mis à jour
4. Si l'utilisateur appuie à nouveau sur la même réaction, elle est supprimée

### 6. Utilisation hors ligne
1. L'utilisateur perd la connexion Internet
2. L'application affiche un indicateur de mode hors ligne
3. L'utilisateur peut continuer à consulter les notes déjà synchronisées
4. L'utilisateur peut créer de nouvelles notes ou ajouter des commentaires
5. Ces modifications sont marquées comme "en attente de synchronisation"
6. Quand la connexion est rétablie, l'application synchronise automatiquement

### 7. Modification d'une note existante
1. L'utilisateur ouvre une note en mode lecture
2. L'utilisateur appuie sur le bouton d'édition
3. L'application affiche l'interface d'édition avec le contenu actuel
4. L'utilisateur modifie le contenu, ajoute/supprime des images
5. L'utilisateur enregistre les modifications
6. L'application revient à la vue de lecture avec les changements appliqués

### 8. Changement d'entreprise
1. L'utilisateur va dans les paramètres de l'application
2. L'utilisateur appuie sur "Changer d'entreprise"
3. L'application demande confirmation et prévient de la déconnexion
4. Après confirmation, l'application retourne à l'écran de bienvenue
5. L'utilisateur saisit un nouveau code entreprise et une nouvelle clé API
6. L'application se connecte au nouvel espace et télécharge les données

### 9. Création d'un nouveau projet
1. L'utilisateur avec les permissions appropriées accède à la page de gestion des projets
2. L'utilisateur appuie sur "Ajouter un projet"
3. L'utilisateur saisit le nom, la description et choisit une couleur
4. L'utilisateur enregistre le nouveau projet
5. Le projet apparaît dans la liste des projets et dans le sélecteur de la page d'accueil

### 10. Synchronisation forcée des données
1. L'utilisateur va dans les paramètres
2. L'utilisateur appuie sur "Synchroniser maintenant"
3. L'application lance une synchronisation complète
4. L'interface affiche la progression de la synchronisation
5. Une fois terminée, l'application indique le succès ou les erreurs

## Parcours administrateur (Fonctionnalité future)

*Note: Dans un premier temps, les entreprises et utilisateurs seront créés manuellement dans la base de données. L'interface d'administration sera développée ultérieurement.*

### 1. Création d'une nouvelle entreprise
1. L'administrateur se connecte à l'interface d'administration backend
2. L'administrateur crée une nouvelle entreprise avec un nom et un code unique
3. L'administrateur peut personnaliser les couleurs et télécharger un logo
4. L'administrateur génère des clés API pour les utilisateurs initiaux
5. L'administrateur partage le code entreprise et les clés avec les utilisateurs

### 2. Gestion des utilisateurs
1. L'administrateur accède à la gestion des utilisateurs d'une entreprise
2. L'administrateur peut ajouter de nouveaux utilisateurs
3. L'administrateur peut générer ou régénérer des clés API
4. L'administrateur peut désactiver des utilisateurs existants