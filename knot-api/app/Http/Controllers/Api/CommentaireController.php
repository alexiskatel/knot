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
            'contenu' => 'required|string',
            'type' => 'required|in:texte,audio',
            'note_id' => 'required|integer|exists:notes,id',
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

        // Filtrage par note si fourni
        if ($request->has('note_id')) {
            $query->where('note_id', $request->note_id);
        }

        return $query;
    }

    /**
     * Méthode pour récupérer tous les commentaires d'une note
     */
    public function getByNote(Request $request, int $noteId)
    {
        // Ajouter le filtre de note à la requête
        $request->merge(['note_id' => $noteId]);

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