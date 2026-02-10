# Système CRUD Intelligent pour Laravel

## Vue d'ensemble

Ce système fournit un framework intelligent et dynamique pour créer des APIs RESTful avec des fonctionnalités avancées de filtrage, tri, pagination, formatage automatique des réponses, et **gestion optimisée des tables associatives (pivots)**.

## Composants principaux

### 1. BaseApiController
Classe de base pour tous les contrôleurs API avec fonctionnalités intégrées :

- **Filtrage automatique** : Support des opérateurs (gt, lt, like, not, in)
- **Tri dynamique** : Tri par champs multiples avec directions
- **Recherche globale** : Recherche dans plusieurs champs
- **Pagination intelligente** : Configuration flexible
- **Chargement de relations** : Includes dynamiques
- **Validation automatique** : Règles de validation configurables
- **Réponses standardisées** : Format JSON cohérent
- **Gestion des tables pivots** : Attach, detach, sync pour relations many-to-many
- **Paramètre `all`** : Récupération de tous les résultats sans pagination

### 2. ApiResponseFormatter
Service de formatage des réponses avec :

- Formatage automatique des modèles et collections
- Métadonnées intégrées (timestamp, version, environnement)
- Gestion des erreurs standardisée
- Support de la pagination avancée

### 3. Fonctions utilitaires (ApiHelper)
Fonctions helper pour usage commun :

- `api_success()` - Réponse de succès
- `api_error()` - Réponse d'erreur
- `format_paginated_response()` - Formatage pagination
- `apply_dynamic_filter()` - Application de filtres dynamiques
- `validate_api_request()` - Validation des requêtes

### 4. Validation des requêtes GET
Le système inclut désormais une validation automatique des paramètres de requête GET pour améliorer la sécurité et la robustesse des APIs :

- **Validation automatique** : Tous les paramètres GET sont validés selon des règles prédéfinies
- **Sécurité renforcée** : Prévention des injections et des paramètres malformés
- **Messages d'erreur cohérents** : Erreurs de validation standardisées pour les requêtes GET
- **Configuration flexible** : Règles de validation personnalisables via `getQueryValidationRules()`

### 5. Messages de validation personnalisables
Le système permet désormais de personnaliser les messages de validation pour toutes les opérations CRUD :

- **Messages GET personnalisés** : Via `getQueryValidationMessages()`
- **Messages CRUD personnalisés** : Via `getValidationMessages()`
- **Messages en français par défaut** : Pour une meilleure expérience utilisateur
- **Flexibilité totale** : Possibilité de surcharger tous les messages

### 6. Recherche dans les tables étrangères
Fonctionnalité avancée permettant la recherche dans les tables liées :

- **Recherche transversale** : Recherche dans les champs des tables associées
- **Configuration simple** : Via `$foreignSearchFields`
- **Performance optimisée** : Utilise `whereHas` pour éviter les N+1 queries
- **Format flexible** : Support des alias pour les jointures complexes

## Utilisation

### Création d'un contrôleur API

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\BaseApiController;
use App\Models\YourModel;
use Illuminate\Http\Request;

class YourModelController extends BaseApiController
{
    protected array $defaultIncludes = ['relation1', 'relation2'];
    protected array $allowedFilters = ['field1', 'field2', 'status'];
    protected array $allowedSorts = ['id', 'name', 'created_at'];
    protected array $searchableFields = ['name', 'description'];
    protected int $defaultPerPage = 20;

    protected function getModel(): string
    {
        return YourModel::class;
    }

    protected function getValidationRules(?int $id = null): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:your_models,email' . ($id ? ",$id" : ''),
            'status' => 'boolean',
        ];
    }
}
```

### Routes API

```php
// routes/api.php
Route::prefix('v1')->group(function () {
    Route::apiResource('your-models', YourModelController::class);

    // Routes supplémentaires
    Route::get('your-models/active', [YourModelController::class, 'getActive']);
    Route::post('your-models/bulk-update', [YourModelController::class, 'bulkUpdate']);
});
```

## Fonctionnalités de filtrage

### Filtres de base
```
GET /api/v1/your-models?status=true&name=example
```

### Filtres avancés
```
GET /api/v1/your-models?status=not:false&created_at=gt:2024-01-01&name=like:search
```

### Opérateurs supportés
- `=` : Égalité (défaut)
- `not:` : Différent de
- `like:` : Recherche partielle
- `gt:` : Supérieur à
- `gte:` : Supérieur ou égal
- `lt:` : Inférieur à
- `lte:` : Inférieur ou égal
- `in:` : Dans la liste (séparée par virgules)

### Filtres multiples
```
GET /api/v1/your-models?status=true&type=in:admin,user&created_at=gt:2024-01-01
```

## Tri et pagination

### Tri simple
```
GET /api/v1/your-models?sort=name
GET /api/v1/your-models?sort=-created_at  // Décroissant
```

### Tri multiple
```
GET /api/v1/your-models?sort=name,-created_at,status
```

### Pagination
```
GET /api/v1/your-models?page=2&per_page=50
```

## Recherche globale

```
GET /api/v1/your-models?search=keyword
```

Recherche dans tous les champs définis dans `$searchableFields`.

## Chargement de relations

### Includes par défaut
Définis dans `$defaultIncludes` du contrôleur.

### Includes dynamiques
```
GET /api/v1/your-models?includes=relation1,relation2.subrelation
```

## Gestion des tables pivots (Relations Many-to-Many)

### Vue d'ensemble
Le système supporte nativement les opérations CRUD sur les relations many-to-many via les paramètres `attach`, `detach`, et `sync` dans les méthodes `store` et `update`.

### Opérations disponibles

#### 1. Attacher des relations (Attach)
Ajoute de nouvelles relations sans supprimer les existantes.

```php
// Via requête POST/PUT
{
  "nom": "Nouveau rôle",
  "attach": {
    "permissions": [1, 3, 5]
  }
}
```

#### 2. Détacher des relations (Detach)
Supprime des relations existantes.

```php
// Via requête PUT
{
  "detach": {
    "permissions": [2, 4]
  }
}
```

#### 3. Synchroniser des relations (Sync)
Remplace toutes les relations existantes par les nouvelles.

```php
// Via requête PUT
{
  "sync": {
    "permissions": [1, 3, 5, 7]
  }
}
```

### Exemples d'utilisation

#### Création avec relations
```php
// POST /api/v1/roles
{
  "nom_du_role": "Administrateur",
  "description": "Rôle administrateur complet",
  "attach": {
    "permissions": [1, 2, 3, 4, 5]
  }
}
```

#### Mise à jour avec gestion des relations
```php
// PUT /api/v1/roles/1
{
  "description": "Rôle administrateur mis à jour",
  "sync": {
    "permissions": [1, 3, 5, 7, 9]
  }
}
```

#### Gestion de relations avec données pivot
```php
// Pour les tables avec attributs supplémentaires
{
  "attach": {
    "permissions": [
      {"id": 1, "pivot": {"expires_at": "2024-12-31"}},
      {"id": 3, "pivot": {"expires_at": "2024-12-31"}}
    ]
  }
}
```

### Réponse avec opérations pivot
```json
{
  "success": true,
  "message": "Enregistrement mis à jour avec succès (sync_permissions)",
  "data": {
    "id": 1,
    "nom_du_role": "Administrateur",
    "permissions": [...]
  },
  "timestamp": "2024-01-01T12:00:00.000000Z"
}
```

## Paramètre `all` pour liste complète

### Utilisation
Récupère tous les résultats sans pagination.

```
GET /api/v1/your-models?all=1
# ou
GET /api/v1/your-models?all=true
```

### Réponse
```json
{
  "success": true,
  "message": "Enregistrements récupérés avec succès",
  "data": {
    "data": [...],     // Tous les résultats
    "count": 150,      // Nombre total
    "total": 150       // Total (même valeur)
  },
  "timestamp": "2024-01-01T12:00:00.000000Z"
}
```

### Combinaisons possibles
```bash
# Liste complète filtrée
GET /api/v1/roles?all=1&statut=true

# Liste complète avec relations
GET /api/v1/roles?all=true&includes=permissions,users

# Liste complète triée
GET /api/v1/roles?all=1&sort=nom_du_role
```

## Format des réponses

### Réponse de succès
```json
{
  "success": true,
  "message": "Records retrieved successfully",
  "data": [...],
  "meta": {
    "timestamp": "2024-01-01T12:00:00.000000Z",
    "version": "1.0.0",
    "environment": "production"
  }
}
```

### Réponse paginée
```json
{
  "success": true,
  "message": "Records retrieved successfully",
  "data": [...],
  "pagination": {
    "current_page": 1,
    "per_page": 20,
    "total": 100,
    "last_page": 5,
    "from": 1,
    "to": 20,
    "has_more_pages": true
  },
  "links": {
    "first": "http://api.example.com/v1/models?page=1",
    "last": "http://api.example.com/v1/models?page=5",
    "prev": null,
    "next": "http://api.example.com/v1/models?page=2"
  },
  "meta": {...}
}
```

### Réponse d'erreur
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "name": ["The name field is required."],
    "email": ["The email must be a valid email address."]
  },
  "meta": {...}
}
```

## Utilisation des helpers

### Dans un contrôleur
```php
use function App\Helpers\ApiHelper\api_success;
use function App\Helpers\ApiHelper\api_error;

public function customMethod()
{
    try {
        $data = $this->processData();
        return api_success($data, 'Data processed successfully');
    } catch (\Exception $e) {
        return api_error('Processing failed', 500);
    }
}
```

### Formatage personnalisé
```php
use App\Services\ApiResponseFormatter;

public function customResponse()
{
    $formatter = new ApiResponseFormatter();
    return $formatter->success($data, 'Custom message')
                    ->withMeta(['custom_field' => 'value']);
}
```

## Configuration avancée

### Personnalisation des filtres
```php
protected function applyFilters(Builder $query, Request $request): void
{
    parent::applyFilters($query, $request);

    // Filtres personnalisés
    if ($request->has('custom_filter')) {
        $query->where('custom_field', $request->custom_filter);
    }
}
```

### Validation personnalisée
```php
protected function validateRequest(Request $request, ?int $id = null): array
{
    $rules = parent::getValidationRules($id);

    // Règles conditionnelles
    if ($request->type === 'special') {
        $rules['special_field'] = 'required|string';
    }

    return validate_api_request($request->all(), $rules);
}
```

### Personnalisation de la validation GET
```php
protected function getQueryValidationRules(): array
{
    $rules = parent::getQueryValidationRules();

    // Ajouter des règles personnalisées
    $rules['custom_param'] = 'nullable|string|max:50';
    $rules['date_range'] = 'nullable|date';

    return $rules;
}
```

#### Règles de validation GET par défaut
```php
[
    'page' => 'nullable|integer|min:1',
    'per_page' => 'nullable|integer|min:1|max:100',
    'sort' => 'nullable|string',
    'includes' => 'nullable|string',
    'search' => 'nullable|string|min:1|max:255',
    'all' => 'nullable|boolean',
]
```

#### Exemples de requêtes GET validées
```bash
# Requête valide
GET /api/v1/users?page=2&per_page=50&sort=name&includes=roles&search=john

# Requête invalide (per_page trop élevé)
GET /api/v1/users?per_page=150

# Requête invalide (page négative)
GET /api/v1/users?page=-1

# Requête invalide (search vide)
GET /api/v1/users?search=
```

#### Personnalisation des messages de validation GET
```php
protected function getQueryValidationMessages(): array
{
    return [
        'page.integer' => 'Le numéro de page doit être un nombre entier.',
        'page.min' => 'Le numéro de page doit être supérieur à 0.',
        'per_page.integer' => 'Le nombre d\'éléments par page doit être un nombre entier.',
        'per_page.min' => 'Le nombre d\'éléments par page doit être supérieur à 0.',
        'per_page.max' => 'Le nombre d\'éléments par page ne peut pas dépasser 100.',
        'search.min' => 'Le terme de recherche doit contenir au moins un caractère.',
        'search.max' => 'Le terme de recherche ne peut pas dépasser 255 caractères.',
    ];
}
```

#### Personnalisation des messages de validation CRUD
```php
protected function getValidationMessages(): array
{
    return [
        'nom_du_role.required' => 'Le nom du rôle est obligatoire.',
        'nom_du_role.unique' => 'Ce nom de rôle existe déjà.',
        'description.string' => 'La description doit être une chaîne de caractères.',
        'statut.boolean' => 'Le statut doit être vrai ou faux.',
    ];
}
```

#### Rendre des paramètres GET obligatoires
```php
protected function getCustomQueryValidationRules(): array
{
    return [
        'departement_id' => 'required|integer|exists:departements,id',
        'statut' => 'sometimes|boolean', // Optionnel mais validé s'il est présent
    ];
}
```

## Recherche dans les tables étrangères

### Configuration
```php
class CommuneController extends BaseApiController
{
    protected array $foreignSearchFields = [
        'departement.libelle',  // Recherche dans le libellé du département
        'region.nom_region',    // Recherche dans le nom de la région
    ];

    // ... autres configurations
}
```

### Utilisation
```bash
# Recherche dans les communes et leurs départements
GET /api/v1/communes?search=paris

# Cela recherchera "paris" dans :
# - Les champs locaux des communes (nom, code_postal, etc.)
# - Le libellé du département associé
# - Le nom de la région associé
```

### Format des champs de recherche étrangère
```php
protected array $foreignSearchFields = [
    // Format simple : 'relation.field'
    'departement.libelle',
    'region.nom_region',

    // Format avec alias : ['relation.field' => 'alias']
    'departement.libelle' => 'dept_libelle',
    'region.nom_region' => 'region_name',
];
```

### Exemple complet d'implémentation avec paramètres GET obligatoires
```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\BaseApiController;
use App\Models\Commune;

class CommuneController extends BaseApiController
{
    protected array $defaultIncludes = ['departement', 'region'];
    protected array $allowedFilters = ['code_postal', 'statut', 'departement_id'];
    protected array $allowedSorts = ['id', 'nom_commune', 'code_postal', 'created_at'];
    protected array $searchableFields = ['nom_commune', 'code_postal'];
    protected array $foreignSearchFields = [
        'departement.libelle',
        'region.nom_region',
    ];

    protected function getModel(): string
    {
        return Commune::class;
    }

    protected function getValidationRules(?int $id = null): array
    {
        return [
            'nom_commune' => 'required|string|max:255',
            'code_postal' => 'required|string|size:5',
            'departement_id' => 'required|exists:departements,id',
            'statut' => 'boolean',
        ];
    }

    protected function getValidationMessages(): array
    {
        return [
            'nom_commune.required' => 'Le nom de la commune est obligatoire.',
            'code_postal.required' => 'Le code postal est obligatoire.',
            'code_postal.size' => 'Le code postal doit contenir exactement 5 chiffres.',
            'departement_id.required' => 'Le département est obligatoire.',
            'departement_id.exists' => 'Le département sélectionné n\'existe pas.',
        ];
    }

    protected function getQueryValidationMessages(): array
    {
        return [
            'page.integer' => 'Le numéro de page doit être un nombre entier.',
            'per_page.max' => 'Le nombre d\'éléments par page ne peut pas dépasser 100.',
            'search.min' => 'Le terme de recherche doit contenir au moins un caractère.',
            'departement_id.required' => 'Le paramètre departement_id est obligatoire.',
            'departement_id.exists' => 'Le département spécifié n\'existe pas.',
        ];
    }

    protected function getCustomQueryValidationRules(): array
    {
        return [
            'departement_id' => 'required|integer|exists:departements,id',
        ];
    }
}
```

### Utilisation avec paramètres GET obligatoires
```bash
# ✅ Requête valide avec departement_id obligatoire
GET /api/v1/communes?departement_id=75&page=1&per_page=20

# ❌ Requête invalide (departement_id manquant)
GET /api/v1/communes?page=1&per_page=20
# → {"success": false, "message": "Le paramètre departement_id est obligatoire."}

# ❌ Requête invalide (departement_id inexistant)
GET /api/v1/communes?departement_id=999&page=1&per_page=20
# → {"success": false, "message": "Le département spécifié n'existe pas."}
```

## Bonnes pratiques

### Configuration de base
1. **Définissez toujours les `$allowedFilters`** pour la sécurité
2. **Utilisez `$defaultIncludes`** pour les relations fréquemment utilisées
3. **Configurez `$searchableFields`** pour la recherche pertinente
4. **Personnalisez les règles de validation** selon vos besoins
5. **Utilisez les helpers** pour la cohérence
6. **Documentez vos endpoints** avec les paramètres supportés

### Gestion des erreurs
7. **Capturez les ValidationException** dans toutes les méthodes CRUD
8. **Utilisez `handleValidationException()`** pour des réponses JSON cohérentes
9. **Évitez les redirections** vers `/` lors d'erreurs de validation
10. **Retournez toujours des réponses JSON** avec le format standardisé

### Gestion des relations
11. **Utilisez `attach`/`detach`/`sync`** pour gérer les relations many-to-many
12. **Définissez les includes appropriés** pour éviter les N+1 queries
13. **Utilisez le paramètre `all`** judicieusement (attention aux performances)
14. **Validez les données pivot** quand vous utilisez des attributs supplémentaires

### Sécurité et performance
11. **Limitez les `$allowedFilters`** aux champs réellement nécessaires
12. **Utilisez des index** sur les champs fréquemment filtrés/triés
13. **Surveillez les requêtes `all=1`** pour éviter les surcharges mémoire
14. **Validez toujours les relations** avant les opérations pivot
15. **Personnalisez les règles GET** selon vos besoins spécifiques
16. **Surveillez les paramètres de pagination** pour éviter les abus
17. **Utilisez des limites appropriées** pour `per_page` (max 100 par défaut)
18. **Définissez des paramètres GET obligatoires** via `getCustomQueryValidationRules()` quand nécessaire
19. **Validez l'existence des ressources** dans les paramètres GET avec `exists:table,column`

## Exemples d'implémentation

### Contrôleur avec gestion des pivots
```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\BaseApiController;
use App\Models\Role;

class RoleController extends BaseApiController
{
    protected array $defaultIncludes = ['permissions', 'users'];
    protected array $allowedFilters = ['nom_du_role', 'statut'];
    protected array $allowedSorts = ['id', 'nom_du_role', 'created_at'];
    protected array $searchableFields = ['nom_du_role', 'description'];

    protected function getModel(): string
    {
        return Role::class;
    }

    protected function getValidationRules(?int $id = null): array
    {
        return [
            'nom_du_role' => 'required|string|max:255|unique:roles,nom_du_role' . ($id ? ",$id" : ''),
            'description' => 'nullable|string',
            'statut' => 'boolean',
        ];
    }

    // Méthodes personnalisées
    public function active()
    {
        $roles = Role::where('statut', true)
            ->with('permissions')
            ->orderBy('nom_du_role')
            ->get();

        return $this->successResponse([
            'data' => $roles,
            'count' => $roles->count()
        ], 'Rôles actifs récupérés avec succès');
    }
}
```

### Utilisation des opérations pivot
```php
// Créer un rôle avec permissions
POST /api/v1/roles
{
  "nom_du_role": "Manager",
  "description": "Rôle de gestion",
  "statut": true,
  "attach": {
    "permissions": [1, 3, 5]
  }
}

// Modifier un rôle et synchroniser ses permissions
PUT /api/v1/roles/1
{
  "description": "Rôle de gestion mis à jour",
  "sync": {
    "permissions": [2, 4, 6, 8]
  }
}

// Ajouter des permissions sans supprimer les existantes
PUT /api/v1/roles/1
{
  "attach": {
    "permissions": [10, 11]
  }
}
```

### Routes API complètes
```php
// routes/api.php
Route::prefix('v1')->group(function () {
    // CRUD standard
    Route::apiResource('departements', DepartementController::class);
    Route::apiResource('structures', StructureController::class);
    Route::apiResource('communes', CommuneController::class);
    Route::apiResource('roles', RoleController::class);

    // Routes spécialisées
    Route::get('roles/active', [RoleController::class, 'active']);
    Route::get('structures/{id}/users', [StructureController::class, 'getUsers']);
});
```

Voir `app/Http/Controllers/Api/DepartementController.php` pour un exemple complet d'implémentation basique.

## Nouvelles fonctionnalités (v2.0)

### Gestion des tables pivots
- **Attach/Detach/Sync** : Gestion native des relations many-to-many
- **Données pivot** : Support des attributs supplémentaires sur les relations
- **Validation automatique** : Vérification des relations avant opérations
- **Messages informatifs** : Retour des opérations effectuées

### Paramètre `all`
- **Liste complète** : Récupération de tous les résultats sans pagination
- **Métadonnées** : Count et total inclus automatiquement
- **Performance** : Utilisation judicieuse pour éviter la surcharge

### Validation avancée des requêtes GET
- **Validation automatique** : Tous les paramètres GET validés selon des règles prédéfinies
- **Messages personnalisables** : Messages d'erreur en français par défaut
- **Sécurité renforcée** : Prévention des injections et paramètres malformés
- **Configuration flexible** : Règles de validation surchargables

### Messages de validation personnalisables
- **Messages GET personnalisés** : Via `getQueryValidationMessages()`
- **Messages CRUD personnalisés** : Via `getValidationMessages()`
- **Messages en français par défaut** : Meilleure expérience utilisateur
- **Flexibilité totale** : Possibilité de surcharger tous les messages

### Recherche dans les tables étrangères
- **Recherche transversale** : Recherche dans les champs des tables associées
- **Configuration simple** : Via `$foreignSearchFields`
- **Performance optimisée** : Utilise `whereHas` pour éviter les N+1 queries
- **Format flexible** : Support des alias pour les jointures complexes

### Gestion d'erreurs améliorée
- **Try-catch dans toutes les méthodes** : Capture des ValidationException et autres exceptions
- **Réponses JSON cohérentes** : Évite les redirections vers `/` lors d'erreurs
- **Messages d'erreur détaillés** : Erreurs spécifiques avec contexte complet
- **Gestion d'exceptions globale** : `handleValidationException()` pour traitement uniforme

### Améliorations générales
- **Réponses enrichies** : Timestamps et métadonnées complètes
- **Gestion d'erreurs** : Messages d'erreur plus précis
- **Validation flexible** : Règles conditionnelles supportées
- **Sécurité renforcée** : Filtres et tris contrôlés
- **Protection contre les abus** : Limites et contraintes sur les paramètres de pagination

## Extension

Le système est conçu pour être extensible. Vous pouvez :

- **Créer des traits** pour des fonctionnalités spécifiques
- **Étendre `BaseApiController`** pour des cas particuliers
- **Ajouter des middlewares personnalisés** pour l'authentification ou la journalisation
- **Créer des services spécialisés** pour la logique métier complexe
- **Utiliser les opérations pivot** pour gérer les relations many-to-many
- **Implémenter des contrôleurs spécialisés** pour les tables associatives complexes

### Exemple d'extension pour tables pivot
```php
class RolePermissionController extends Controller
{
    public function attach(Request $request, $roleId)
    {
        $role = Role::findOrFail($roleId);
        $role->permissions()->attach($request->permission_id);

        return response()->json([
            'success' => true,
            'message' => 'Permission ajoutée',
            'data' => $role->load('permissions')
        ]);
    }
}
```

Ce système vous permet de créer des APIs puissantes et cohérentes avec un minimum de code répétitif, tout en gardant une grande flexibilité pour les cas spécifiques, **y compris la gestion avancée des relations many-to-many**.
