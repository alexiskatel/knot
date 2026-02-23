<?php

namespace App\Http\Controllers\Api;

use App\Models\Team;
use App\Http\Controllers\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class TeamController extends BaseApiController
{
    protected array $defaultIncludes = ['users'];
    protected array $allowedFilters = ['nom', 'code_unique', 'statut'];
    protected array $allowedSorts = ['id', 'nom', 'created_at'];
    protected array $searchableFields = ['nom', 'code_unique', 'description'];
    protected array $fileFields = ['logo_id'];

    /**
     * Get the model class name
     */
    protected function getModel(): string
    {
        return Team::class;
    }

    /**
     * Get validation rules for store/update
     */
    protected function getValidationRules(?int $id = null): array
    {
        return [
            'nom'             => 'required|string|max:255',
            'code_unique'     => 'required|string|max:50|' . ($id ? 'unique:teams,code_unique,' . $id : 'unique:teams'),
            'couleur_primaire' => 'nullable|string|max:20',
            'description'     => 'nullable|string',
            'statut'          => 'boolean',
            'logo_id'         => 'nullable|exists:medias,id',
        ];
    }

    /**
     * Valider un code team
     */
    public function validateCode(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'code' => 'required|string|min:3|max:50'
            ]);

            $code = $request->input('code');
            $team = Team::where('code_unique', $code)
                ->where('statut', true)
                ->first();

            if (!$team) {
                return $this->errorResponse('Code team invalide ou inactif.', 404);
            }

            $data = [
                'id'              => $team->id,
                'nom'             => $team->nom,
                'couleur_primaire' => $team->couleur_primaire,
            ];

            return $this->successResponse($data, 'Code team valide.');
        } catch (\Exception $e) {
            return $this->errorResponse('Une erreur est survenue: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Récupère les membres actifs du team
     */
    public function members(Request $request, int $teamId): JsonResponse
    {
        $users = \App\Models\User::where('team_id', $teamId)
            ->where('statut', true)
            ->select(['id', 'nom', 'prenom', 'email'])
            ->get();

        return $this->successResponse($users, 'Membres récupérés avec succès.');
    }

    /**
     * Génère un code unique pour le team
     */
    public function generateUniqueCode(Request $request): JsonResponse
    {
        $request->validate([
            'nom' => 'required|string|min:2'
        ]);

        $nom = $request->input('nom');

        $baseCode   = preg_replace('/[^a-zA-Z0-9]/', '', $nom);
        $baseCode   = strtoupper(substr($baseCode, 0, 5));
        $uniqueCode = $baseCode . '-' . strtoupper(Str::random(4));

        while (Team::where('code_unique', $uniqueCode)->exists()) {
            $uniqueCode = $baseCode . '-' . strtoupper(Str::random(4));
        }

        return $this->successResponse(['code' => $uniqueCode], 'Code unique généré avec succès.');
    }
}
