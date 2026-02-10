# API Controllers Generator

Cette commande permet de générer automatiquement des contrôleurs API et leurs routes à partir des modèles existants, en s'intégrant parfaitement avec le système BaseApiController.

## Fonctionnalités

- **Génération automatique de contrôleurs** : Crée des contrôleurs qui étendent `BaseApiController`
- **Routes automatiques** : Ajoute les routes API resource correspondantes
- **Support des fichiers de routes séparés** : Possibilité de regrouper les routes dans des fichiers dédiés
- **Détection intelligente des modèles** : Scan automatique du dossier `app/Models`
- **Évite les doublons** : Ne génère pas de contrôleurs ou routes déjà existants

## Utilisation

### Générer des contrôleurs pour tous les modèles

```bash
php artisan api:generate-controllers
```

Par défaut, cela génère les contrôleurs ET les routes dans `routes/api.php`.

### Générer un contrôleur pour un modèle spécifique

```bash
php artisan api:generate-controllers --model=User
```

### Générer seulement les contrôleurs (sans routes)

```bash
php artisan api:generate-controllers --no-routes
```

Utile si vous voulez créer les contrôleurs sans toucher aux routes.

### Générer des routes dans un fichier séparé

```bash
php artisan api:generate-controllers --routes=users
```

Cela créera :

- Le contrôleur `app/Http/Controllers/Api/UserController.php`
- Le fichier de routes `routes/users.php` avec les routes correspondantes

### Combinaison d'options

```bash
# Contrôleur spécifique sans routes
php artisan api:generate-controllers --model=Product --no-routes

# Contrôleur spécifique avec routes séparées
php artisan api:generate-controllers --model=Product --routes=products
```

## Structure générée

### Contrôleur généré

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\BaseApiController;
use App\Models\User;

class UserController extends BaseApiController
{
    protected array $defaultIncludes = [];
    protected array $allowedFilters = [];
    protected array $allowedSorts = ['id', 'created_at', 'updated_at'];
    protected array $searchableFields = [];

    protected function getModel(): string
    {
        return User::class;
    }

    protected function getValidationRules(?int $id = null): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8'
        ];
    }
}
```

**Les règles de validation sont générées automatiquement** basées sur les propriétés `fillable` du modèle et l'analyse des migrations :

- **Analyse des migrations** : Détecte automatiquement les champs `nullable()` pour utiliser `nullable` au lieu de `required`
- **Champs spéciaux** :
  - `email` → `required|email|unique:table,column,{$id}` (exclut l'ID actuel lors des updates)
  - `password` → `sometimes|required|string|min:8` (requis seulement à la création)
- **Clés étrangères** : `*_id` → `required|exists:related_table,id` (ou `nullable` si nullable en DB)
- **Types détectés** :
  - `name`, `title`, `description` → `required|string|max:255` (ou `nullable`)
  - `price`, `amount` → `required|numeric|min:0` (ou `nullable`)
  - `quantity`, `count` → `required|integer|min:0` (ou `nullable`)
  - `active`, `enabled` → `boolean`

### Routes générées

Dans `routes/api.php` (par défaut) :

```php
Route::middleware('auth:sanctum')->group(function () {
    // ... autres routes
    Route::apiResource('users', \App\Http\Controllers\Api\UserController::class);
});
```

Dans un fichier séparé `routes/users.php` :

```php
<?php

use Illuminate\Support\Facades\Route;

Route::apiResource('users', \App\Http\Controllers\Api\UserController::class);
```

## Intégration avec BaseApiController

Les contrôleurs générés héritent automatiquement de `BaseApiController`, qui fournit :

- **CRUD complet** : index, show, store, update, destroy
- **Filtrage avancé** : filtres, recherche, tri
- **Pagination automatique**
- **Gestion des relations** : includes, eager loading
- **Validation intelligente**
- **Réponses JSON standardisées**

## Personnalisation

Après génération, vous pouvez personnaliser les contrôleurs en modifiant :

- `$defaultIncludes` : relations à charger par défaut
- `$allowedFilters` : champs filtrables
- `$allowedSorts` : champs triables
- `$searchableFields` : champs de recherche
- `getValidationRules()` : règles de validation

## Exemple d'utilisation complète

1. **Créer un modèle avec Reliese** :

   ```bash
   php artisan reliese:model
   ```

2. **Générer le contrôleur et les routes** :

   ```bash
   php artisan api:generate-controllers --model=Product --routes=products
   ```

3. **Inclure le fichier de routes dans `api.php`** :

   ```php
   Route::prefix('v1')->group(function () {
       require __DIR__ . '/products.php';
   });
   ```

4. **Personnaliser le contrôleur** :

   ```php
   class ProductController extends BaseApiController
   {
       protected array $defaultIncludes = ['category', 'tags'];
       protected array $allowedFilters = ['category_id', 'price'];
       protected array $searchableFields = ['name', 'description'];

       protected function getValidationRules(?int $id = null): array
       {
           return [
               'name' => 'required|string|max:255',
               'price' => 'required|numeric|min:0',
               'category_id' => 'required|exists:categories,id',
           ];
       }
   }
   ```

## Routes disponibles

Pour chaque modèle, les routes suivantes sont générées :

- `GET /api/v1/{resource}` - Lister les ressources
- `POST /api/v1/{resource}` - Créer une ressource
- `GET /api/v1/{resource}/{id}` - Afficher une ressource
- `PUT/PATCH /api/v1/{resource}/{id}` - Modifier une ressource
- `DELETE /api/v1/{resource}/{id}` - Supprimer une ressource

## Options de requête supportées

Le BaseApiController supporte de nombreux paramètres de requête :

- `?page=1&per_page=10` - Pagination
- `?sort=name,-created_at` - Tri (asc/desc avec -)
- `?includes=relation1,relation2` - Charger les relations
- `?search=term` - Recherche textuelle
- `?field=value` - Filtres
- `?all=1` - Récupérer tous les résultats sans pagination

## Sécurité

Par défaut, les routes sont placées dans le groupe middleware `auth:sanctum`. Assurez-vous que vos routes nécessitent une authentification appropriée.

## Notes importantes

- Les modèles système Laravel (Cache, Job, etc.) sont automatiquement ignorés
- Les contrôleurs existants ne sont pas écrasés
- Les routes dupliquées sont détectées et ignorées
- Le nom des routes suit la convention snake_case pluriel du modèle
