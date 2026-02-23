<?php

namespace App\Http\Controllers\Api;

use App\Models\Reaction;
use App\Http\Controllers\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ReactionController extends BaseApiController
{
    protected array $defaultIncludes = ['auteur'];
    protected array $allowedFilters = ['type', 'commentaire_id', 'auteur_id', 'team_id'];
    protected array $allowedSorts = ['id', 'type', 'created_at'];
    protected array $searchableFields = ['type'];

    /**
     * Get the model class name
     */
    protected function getModel(): string
    {
        return Reaction::class;
    }

    /**
     * Get validation rules for store/update
     */
    protected function getValidationRules(?int $id = null): array
    {
        return [
            'type' => 'required|string|max:10',
            'commentaire_id' => 'required|integer|exists:commentaires,id',
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

        // Filtrage par commentaire si fourni
        if ($request->has('commentaire_id')) {
            $query->where('commentaire_id', $request->commentaire_id);
        }

        return $query;
    }

    /**
     * Méthode pour récupérer toutes les réactions d'un commentaire
     */
    public function getByCommentaire(Request $request, int $commentaireId)
    {
        // Ajouter le filtre de commentaire à la requête
        $request->merge(['commentaire_id' => $commentaireId]);

        // Utiliser la méthode index standard
        return $this->index($request);
    }

    /**
     * Override de la méthode store pour ajouter la génération du sync_id
     * et vérifier les contraintes d'unicité des réactions
     */
    public function store(Request $request): \Illuminate\Http\JsonResponse
    {
        try {
            // Validation des entrées
            $data = $this->validateRequest($request);

            // Vérifier si l'utilisateur a déjà réagi avec ce type sur ce commentaire
            $existingReaction = Reaction::where('type', $data['type'])
                ->where('commentaire_id', $data['commentaire_id'])
                ->where('auteur_id', $data['auteur_id'])
                ->first();

            // Si une réaction existe déjà, retourner une erreur
            if ($existingReaction) {
                return $this->errorResponse('Vous avez déjà réagi avec ce type à ce commentaire.', 422);
            }

            // Ajouter un sync_id unique s'il n'est pas fourni
            if (!$request->has('sync_id')) {
                $request->merge([
                    'sync_id' => Str::uuid(),
                    'sync_status' => 'synced'
                ]);
            }

            // Utiliser la méthode store du parent
            return parent::store($request);
        } catch (\Exception $e) {
            return $this->errorResponse('Une erreur est survenue lors de l\'ajout de la réaction: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Toggle (ajouter ou supprimer) une réaction
     */
    public function toggle(Request $request)
    {
        try {
            $request->validate([
                'type' => 'required|string|max:10',
                'commentaire_id' => 'required|integer|exists:commentaires,id',
                'auteur_id' => 'required|integer|exists:users,id',
                'team_id' => 'required|integer|exists:teams,id',
            ]);

            // Vérifier si l'utilisateur a déjà réagi avec ce type sur ce commentaire
            $existingReaction = Reaction::where('type', $request->type)
                ->where('commentaire_id', $request->commentaire_id)
                ->where('auteur_id', $request->auteur_id)
                ->first();

            $result = [];
            $message = '';

            // Si une réaction existe, la supprimer
            if ($existingReaction) {
                $existingReaction->delete();
                $result['action'] = 'removed';
                $message = 'Réaction supprimée avec succès.';
            }
            // Sinon, ajouter une nouvelle réaction
            else {
                // Ajouter un sync_id unique
                $request->merge([
                    'sync_id' => Str::uuid(),
                    'sync_status' => 'synced'
                ]);

                $reaction = Reaction::create($request->all());
                $result['reaction'] = $reaction;
                $result['action'] = 'added';
                $message = 'Réaction ajoutée avec succès.';
            }

            return $this->successResponse($result, $message);
        } catch (\Exception $e) {
            return $this->errorResponse('Une erreur est survenue lors du toggle de la réaction: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Mettre à jour le statut de synchronisation d'une réaction
     */
    public function updateSyncStatus(Request $request, int $id)
    {
        try {
            $request->validate([
                'sync_status' => 'required|in:pending,synced',
            ]);

            $reaction = Reaction::findOrFail($id);
            $reaction->sync_status = $request->sync_status;
            $reaction->save();

            return $this->successResponse($reaction, 'Statut de synchronisation mis à jour avec succès.');
        } catch (\Exception $e) {
            return $this->errorResponse('Une erreur est survenue lors de la mise à jour du statut de synchronisation: ' . $e->getMessage(), 500);
        }
    }
}