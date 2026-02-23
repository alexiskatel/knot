<?php

namespace App\Http\Controllers\Api;

use App\Models\Projet;
use App\Http\Controllers\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProjetController extends BaseApiController
{
    protected array $defaultIncludes = [];
    protected array $allowedFilters = ['titre', 'statut', 'team_id'];
    protected array $allowedSorts = ['id', 'titre', 'created_at'];
    protected array $searchableFields = ['titre', 'description'];

    /**
     * Get the model class name
     */
    protected function getModel(): string
    {
        return Projet::class;
    }

    /**
     * Get validation rules for store/update
     */
    protected function getValidationRules(?int $id = null): array
    {
        return [
            'titre' => 'required|string|max:255',
            'description' => 'nullable|string',
            'couleur' => 'nullable|string|max:20',
            'statut' => 'boolean',
            'team_id' => 'required|integer|exists:teams,id',
        ];
    }

    /**
     * Apply additional filters before building the query
     */
    protected function buildQuery(Request $request): \Illuminate\Database\Eloquent\Builder
    {
        $query = parent::buildQuery($request);

        // Filtrage par team si fourni dans la requête
        if ($request->has('team_id')) {
            $query->where('team_id', $request->team_id);
        }

        return $query;
    }

    /**
     * Méthode pour récupérer tous les projets d'un team
     */
    public function getByTeam(Request $request, int $teamId)
    {
        // Ajouter le filtre de team à la requête
        $request->merge(['team_id' => $teamId]);

        // Utiliser la méthode index standard
        return $this->index($request);
    }

    /**
     * Override de la méthode store pour ajouter la génération du sync_id
     */
    public function store(Request $request): \Illuminate\Http\JsonResponse
    {
        // Ajouter un sync_id unique s'il n'est pas fourni
        if (!$request->has('sync_id')) {
            $request->merge(['sync_id' => Str::uuid()]);
        }

        return parent::store($request);
    }
}