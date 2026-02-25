<?php

namespace App\Http\Controllers\Api;

use App\Models\Commentaire;
use App\Http\Controllers\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CommentaireController extends BaseApiController
{
    protected array $defaultIncludes = ['auteur', 'reactions'];
    protected array $allowedFilters = ['type', 'note_id', 'auteur_id', 'team_id'];
    protected array $allowedSorts = ['id', 'created_at', 'updated_at'];
    protected array $searchableFields = ['contenu'];
    protected array $foreignSearchFields = [
        'auteur.nom' => 'auteur_nom'
    ];

    /**
     * Get the model class name
     */
    protected function getModel(): string
    {
        return Commentaire::class;
    }

    /**
     * Get validation rules for store/update
     */
    protected function getValidationRules(?int $id = null): array
    {
        return [
            'contenu'   => 'required|string',
            'type'      => 'required|in:texte,audio',
            'note_id'   => 'nullable|integer|exists:notes,id',
            'tache_id'  => 'nullable|integer|exists:taches,id',
            'auteur_id' => 'required|integer|exists:users,id',
            'team_id'   => 'required|integer|exists:teams,id',
        ];
    }

    /**
     * Apply additional filters before building the query
     */
    protected function buildQuery(Request $request): \Illuminate\Database\Eloquent\Builder
    {
        $query = parent::buildQuery($request);

        if ($request->has('tache_id')) {
            $query->where('tache_id', $request->tache_id);
        }

        return $query;
    }

    /**
     * Récupérer tous les commentaires d'une note
     */
    public function getByNote(Request $request, int $noteId)
    {
        $request->merge(['note_id' => $noteId]);
        return $this->index($request);
    }

    /**
     * Récupérer tous les commentaires d'une tâche
     */
    public function getByTache(Request $request, int $tacheId)
    {
        $request->merge(['tache_id' => $tacheId]);
        return $this->index($request);
    }

    /**
     * Override de la méthode store pour ajouter la génération du sync_id
     * et valider qu'un commentaire est lié à une note OU une tâche.
     */
    public function store(Request $request): \Illuminate\Http\JsonResponse
    {
        if (!$request->note_id && !$request->tache_id) {
            return $this->errorResponse('Un commentaire doit être associé à une note ou une tâche.', 422);
        }

        if (!$request->has('sync_id')) {
            $request->merge([
                'sync_id'     => Str::uuid(),
                'sync_status' => 'synced',
            ]);
        }

        return parent::store($request);
    }

    /**
     * Mettre à jour le statut de synchronisation d'un commentaire
     */
    public function updateSyncStatus(Request $request, int $id)
    {
        try {
            $request->validate([
                'sync_status' => 'required|in:pending,synced',
            ]);

            $commentaire = Commentaire::findOrFail($id);
            $commentaire->sync_status = $request->sync_status;
            $commentaire->save();

            return $this->successResponse($commentaire, 'Statut de synchronisation mis à jour avec succès.');
        } catch (\Exception $e) {
            return $this->errorResponse('Une erreur est survenue lors de la mise à jour du statut de synchronisation: ' . $e->getMessage(), 500);
        }
    }
}