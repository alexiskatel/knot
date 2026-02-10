
### **1. Gestion des utilisateurs et des rôles**

#### **Utilisateur**
Cette table stocke les informations de chaque personne qui utilise le système.
* **Attributs :**
    * `id` (clé primaire)
    * `nom`, `prenom`, `email`, `telephone`
    * `mot_de_passe`, `statut` (actif/inactif), `date_creation`
* **Relations :**
    * `structure_id` (clé étrangère vers `Structure`)
    * `role_id` (clé étrangère vers `Rôle`)
    * Soumet des données : Lié à plusieurs `Saisie`.

#### **Rôle**
Cette table définit les rôles (ex. : Partenaire, Validateur N1) et leurs permissions.
* **Attributs :**
    * `id` (clé primaire)
    * `nom_du_role`, `description`, `statut`
* **Relations :**
    * Assigné à des utilisateurs : Lié à de nombreux `Utilisateur`.
    * Détient des permissions : Lié à la table associative `Role_Permission`.

#### **Permission**
Cette table liste les actions spécifiques (ex. : `SAISIE_DONNEES`, `VALIDER_N1`) qu'un utilisateur peut faire.
* **Attributs :**
    * `id` (clé primaire)
    * `code`, `description`
* **Relations :**
    * Accordée à des rôles : Lié à la table associative `Role_Permission`.

#### **Role_Permission**
Cette table associative relie les rôles aux permissions pour définir les droits de chaque rôle.
* **Attributs :**
    * `role_id` (clé étrangère)
    * `permission_id` (clé étrangère)

---

### **2. Gestion des référentiels**

#### **Structure**
Cette table contient la liste des organisations partenaires.
* **Attributs :**
    * `id` (clé primaire)
    * `nom`, `sigle`, `type_de_structure`, `statut`
* **Relations :**
    * Abrite des utilisateurs : Lié à de nombreux `Utilisateur`.
    * Source de données : Lié à de nombreux enregistrements de `Saisie`.

#### **Département**
Cette table gère la liste des départements.
* **Attributs :**
    * `id` (clé primaire)
    * `nom`
* **Relations :**
    * Contient des communes : Lié à de nombreuses `Commune`.

#### **Commune**
Cette table gère la liste des communes.
* **Attributs :**
    * `id` (clé primaire)
    * `nom`
    * `departement_id` (clé étrangère vers `Département`)
* **Relations :**
    * Appartient à un département : Lié à un seul `Département`.
    * Zone de saisie : Lié à la table associative `Affectation`.
    * Désagrégation géographique : Lié à la table associative `Valeur_Saisie_Detail`.

#### **Thématique**
Cette table classe les indicateurs par sujet.
* **Attributs :**
    * `id` (clé primaire)
    * `nom`, `description`, `statut`
* **Relations :**
    * Organise des indicateurs : Lié à de nombreux `Indicateur`.

#### **Groupe_Indicateur**
Cette table définit les groupes de rapportage (CSI, Canada, Luxembourg).
* **Attributs :**
    * `id` (clé primaire)
    * `nom_du_groupe`, `periodicite`, `statut`
* **Relations :**
    * Contient des indicateurs : Lié à de nombreux `Indicateur`.
    * Définit un calendrier : Lié à la table `Calendrier`.

#### **Désagrégation**
Cette table est une bibliothèque des types de désagrégation (ex. : sexe, tranche d'âge).
* **Attributs :**
    * `id` (clé primaire)
    * `nom`
* **Relations :**
    * Contient des valeurs : Lié à de nombreuses `Valeur_Desagregation`.
    * S'applique à des indicateurs : Lié à la table associative `Indicateur_Desagregation`.

#### **Valeur_Desagregation**
Cette table stocke chaque valeur possible pour une désagrégation, avec une notion d'ordre.
* **Attributs :**
    * `id` (clé primaire)
    * `valeur`, `ordre` (Entier)
    * `desagregation_id` (clé étrangère vers `Désagrégation`)
* **Relations :**
    * Appartient à une désagrégation : Lié à une seule `Désagrégation`.

---

### **3. Gestion des indicateurs et de l'affectation**

#### **Indicateur**
C'est la table centrale pour toutes les fiches d'indicateurs.
* **Attributs :**
    * `id` (clé primaire)
    * `code`, `nom`, `description`, `formule_calcul`
    * `type`, `verrouillage_logique`, `statut`
    * `thematique_id` (clé étrangère vers `Thématique`)
    * `groupe_indicateur_id` (clé étrangère vers `Groupe_Indicateur`)
* **Relations :**
    * Appartient à une thématique : Lié à une seule `Thématique`.
    * Appartient à un groupe : Lié à un seul `Groupe_Indicateur`.
    * Demande des désagrégations : Lié à la table associative `Indicateur_Desagregation`.
    * Concerne des saisies : Lié à de nombreux enregistrements de `Saisie`.

#### **Indicateur_Desagregation**
Cette table associative relie les indicateurs aux désagrégations dont ils ont besoin pour la saisie de données.
* **Attributs :**
    * `indicateur_id` (clé étrangère)
    * `desagregation_id` (clé étrangère)

#### **Affectation**
Cette table associative gère la matrice de responsabilité en reliant les acteurs aux indicateurs et aux zones géographiques.
* **Attributs :**
    * `id` (clé primaire)
    * `partenaire_id` (clé étrangère vers `Structure`)
    * `membre_staff_id` (clé étrangère vers `Utilisateur`)
    * `groupe_indicateur_id` (clé étrangère vers `Groupe_Indicateur`)
    * `commune_id` (clé étrangère vers `Commune`)
    * `date_debut`, `date_fin`, `statut`
* **Relations :**
    * Lie une `Structure`, un `Utilisateur`, un `Groupe_Indicateur` et une `Commune`.

---

### **4. Gestion des données et du workflow de validation**

#### **Saisie**
Cette table enregistre chaque soumission de données pour un indicateur, ainsi que son statut.
* **Attributs :**
    * `id` (clé primaire)
    * `date_soumission`, `periode`
    * `statut_actuel`, `commentaire`
    * `indicateur_id` (clé étrangère vers `Indicateur`)
    * `utilisateur_id` (clé étrangère vers `Utilisateur`)
* **Relations :**
    * Concerne un indicateur : Lié à un seul `Indicateur`.
    * Soumise par un utilisateur : Lié à un seul `Utilisateur`.
    * Contient des détails : Lié à de nombreux enregistrements de `Valeur_Saisie_Detail`.
    * A un historique de validation : Lié à de nombreux enregistrements de `Validation`.

#### **Validation**
Cette table enregistre chaque étape du processus d'approbation (validation ou rejet).
* **Attributs :**
    * `id` (clé primaire)
    * `date_decision`, `decision` (validé/rejeté)
    * `motif`
    * `niveau_validation_id` (clé étrangère vers `Niveau_Validation`)
    * `utilisateur_id` (clé étrangère vers `Utilisateur`, le validateur)
    * `saisie_id` (clé étrangère vers `Saisie`)
* **Relations :**
    * Est faite par un utilisateur : Lié à un seul `Utilisateur`.
    * S'applique à une saisie : Lié à une seule `Saisie`.

#### **Valeur_Saisie_Detail**
Cette table associative enregistre les valeurs d'une saisie et gère les combinaisons de désagrégations (ex. : "filles handicapées").
* **Attributs :**
    * `id` (clé primaire)
    * `valeur_saisie` (Numérique)
    * `saisie_id` (clé étrangère vers `Saisie`)
    * `valeur_desagregation_id` (clé étrangère vers `Valeur_Desagregation`)
    * `commune_id` (clé étrangère vers `Commune`)
* **Relations :**
    * Détaille une saisie : Lié à une seule `Saisie`.
    * Est liée à une valeur de désagrégation : Lié à une seule `Valeur_Desagregation`.
    * Est liée à une commune : Lié à une seule `Commune`.

---

### **5. Logs, calendrier et niveaux dynamiques**

#### **Journal_Activite**
Ce "journal de bord" du système répond à la question "qui a fait quoi, et quand ?".
* **Attributs :**
    * `id` (clé primaire)
    * `date_heure`, `action`, `details_action`, `adresse_ip`
    * `utilisateur_id` (clé étrangère vers `Utilisateur`)
* **Relations :**
    * Documente les actions utilisateurs : Lié à un seul `Utilisateur`.

#### **Calendrier**
Cette table définit les dates limites pour la saisie et la validation, par groupe d'indicateurs et par période.
* **Attributs :**
    * `id` (clé primaire)
    * `periode`
    * `groupe_indicateur_id` (clé étrangère vers `Groupe_Indicateur`)
* **Relations :**
    * S'applique à un groupe : Lié à un seul `Groupe_Indicateur`.

#### **Niveau_Validation**
Table de référence qui définit tous les niveaux de validation dynamiques disponibles dans le système.
* **Attributs :**
    * `id` (clé primaire)
    * `nom`, `code`, `ordre` (Entier), `description`
* **Relations :**
    * Définit un workflow : Lié à la table associative `Groupe_Validation`.

#### **Groupe_Validation**
Cette table associative définit le parcours de validation pour chaque `Groupe_Indicateur`.
* **Attributs :**
    * `id` (clé primaire)
    * `groupe_indicateur_id` (clé étrangère vers `Groupe_Indicateur`)
    * `niveau_validation_id` (clé étrangère vers `Niveau_Validation`)
    * `ordre_validation` (Entier)

#### **Calendrier_Niveau**
Cette table associative relie un calendrier à des dates limites pour chaque niveau de validation.
* **Attributs :**
    * `id` (clé primaire)
    * `calendrier_id` (clé étrangère vers `Calendrier`)
    * `niveau_validation_id` (clé étrangère vers `Niveau_Validation`)
    * `date_limite` (Date)
