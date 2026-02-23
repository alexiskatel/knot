<?php

namespace App\Http\Controllers\Api;

use App\Models\Note;
use App\Http\Controllers\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class NoteController extends BaseApiController
{
    protected array $defaultIncludes = [];
    protected array $allowedFilters = ['titre', 'statut', 'projet_id', 'auteur_id', 'team_id'];
    protected array $allowedSorts = ['id', 'titre', 'created_at', 'updated_at'];
    protected array $searchableFields = ['titre', 'contenu'];
    protected array $foreignSearchFields = [
        'projet.titre' => 'projet_titre',
        'auteur.nom' => 'auteur_nom'
    ];

    /**
     * Get the model class name
     */
    protected function getModel(): string
    {
        return Note::class;
    }

    /**
     * Get validation rules for store/update
     */
    protected function getValidationRules(?int $id = null): array
    {
        return [
            'titre' => 'required|string|max:255',
            'contenu' => 'required|string',
            'statut' => 'required|in:brouillon,publié,archivé',
            'projet_id' => 'required|integer|exists:projets,id',
            'auteur_id' => 'required|integer|exists:users,id',
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

        // Filtrage par projet si fourni
        if ($request->has('projet_id')) {
            $query->where('projet_id', $request->projet_id);
        }

        return $query;
    }

    /**
     * Méthode pour récupérer toutes les notes d'un projet
     */
    public function getByProjet(Request $request, int $projetId)
    {
        // Ajouter le filtre de projet à la requête
        $request->merge(['projet_id' => $projetId]);

        // Utiliser la méthode index standard
        return $this->index($request);
    }

    /**
     * Méthode pour récupérer toutes les notes d'un team
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
            $request->merge([
                'sync_id' => Str::uuid(),
                'sync_status' => 'synced'
            ]);
        }

        return parent::store($request);
    }

    /**
     * Mettre à jour le statut de synchronisation d'une note
     */
    public function updateSyncStatus(Request $request, int $id)
    {
        try {
            $request->validate([
                'sync_status' => 'required|in:pending,synced',
            ]);

            $note = Note::findOrFail($id);
            $note->sync_status = $request->sync_status;
            $note->save();

            return $this->successResponse($note, 'Statut de synchronisation mis à jour avec succès.');
        } catch (\Exception $e) {
            return $this->errorResponse('Une erreur est survenue lors de la mise à jour du statut de synchronisation: ' . $e->getMessage(), 500);
        }
    }
}