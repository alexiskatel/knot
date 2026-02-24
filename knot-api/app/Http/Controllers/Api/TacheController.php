<?php

namespace App\Http\Controllers\Api;

use App\Models\Tache;
use App\Http\Controllers\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class TacheController extends BaseApiController
{
    protected array $defaultIncludes = [];
    protected array $allowedFilters = ['statut', 'projet_id', 'auteur_id', 'assigne_id', 'team_id'];
    protected array $allowedSorts = ['id', 'titre', 'statut', 'due_date', 'created_at'];
    protected array $searchableFields = ['titre', 'description'];
    protected array $foreignSearchFields = [
        'projet.titre' => 'projet_titre',
        'assigne.nom'  => 'assigne_nom',
    ];

    /**
     * Get the model class name
     */
    protected function getModel(): string
    {
        return Tache::class;
    }

    /**
     * Get validation rules for store/update
     */
    protected function getValidationRules(?int $id = null): array
    {
        return [
            'titre'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'statut'      => 'in:todo,en_cours,done',
            'projet_id'   => 'required|integer|exists:projets,id',
            'auteur_id'   => 'required|integer|exists:users,id',
            'assigne_id'  => 'nullable|integer|exists:users,id',
            'team_id'     => 'required|integer|exists:teams,id',
            'due_date'    => 'nullable|date',
        ];
    }

    /**
     * Apply additional filters before building the query
     */
    protected function buildQuery(Request $request): \Illuminate\Database\Eloquent\Builder
    {
        $query = parent::buildQuery($request);

        if ($request->has('team_id')) {
            $query->where('team_id', $request->team_id);
        }

        if ($request->has('projet_id')) {
            $query->where('projet_id', $request->projet_id);
        }

        if ($request->has('assigne_id')) {
            $query->where('assigne_id', $request->assigne_id);
        }

        return $query;
    }

    /**
     * Override store pour générer le sync_id
     */
    public function store(Request $request): JsonResponse
    {
        if (!$request->has('sync_id')) {
            $request->merge([
                'sync_id'     => Str::uuid(),
                'sync_status' => 'synced',
            ]);
        }

        return parent::store($request);
    }

    /**
     * Récupérer toutes les tâches d'un projet
     */
    public function getByProjet(Request $request, int $projetId): JsonResponse
    {
        $request->merge(['projet_id' => $projetId]);
        return $this->index($request);
    }

    /**
     * Récupérer toutes les tâches d'un team
     */
    public function getByTeam(Request $request, int $teamId): JsonResponse
    {
        $request->merge(['team_id' => $teamId]);
        return $this->index($request);
    }

    /**
     * Mettre à jour le statut de synchronisation d'une tâche
     */
    public function updateSyncStatus(Request $request, int $id): JsonResponse
    {
        try {
            $request->validate([
                'sync_status' => 'required|in:pending,synced',
            ]);

            $tache = Tache::findOrFail($id);
            $tache->sync_status = $request->sync_status;
            $tache->save();

            return $this->successResponse($tache, 'Statut de synchronisation mis à jour avec succès.');
        } catch (\Exception $e) {
            return $this->errorResponse('Une erreur est survenue: ' . $e->getMessage(), 500);
        }
    }
}
