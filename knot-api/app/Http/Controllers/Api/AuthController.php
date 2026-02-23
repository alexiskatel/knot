<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\BaseApiController;
use App\Models\User;
use App\Models\Team;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Auth API Controller
 *
 * Gestion de l'authentification avec API Keys et Laravel Sanctum
 */
class AuthController extends BaseApiController
{
    protected array $defaultIncludes = [];
    protected array $allowedFilters = [];
    protected array $allowedSorts = [];
    protected array $searchableFields = [];

    /**
     * Get the model class name (not used for auth)
     */
    protected function getModel(): string
    {
        return ''; // Auth doesn't use a specific model
    }

    /**
     * Login user and create token (ancienne méthode avec Sanctum)
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Les identifiants fournis sont incorrects.'],
            ]);
        }

        // Vérifier que l'utilisateur est actif
        if (!$user->statut) {
            throw ValidationException::withMessages([
                'email' => ['Votre compte est désactivé.'],
            ]);
        }

        // Supprimer les anciens tokens
        $user->tokens()->delete();

        // Créer un nouveau token
        $token = $user->createToken('auth_token')->plainTextToken;

        // Charger les relations nécessaires
        $user->load(['team']);

        return $this->successResponse([
            'token' => $token,
            'user' => $user,
        ]);
    }

    /**
     * Logout user and revoke token
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return $this->successResponse([
            'message' => 'Déconnexion réussie',
        ]);
    }

    /**
     * Get authenticated user info
     */
    public function user(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return $this->errorResponse('Utilisateur non authentifié', 401);
        }

        // Charger les relations nécessaires
        $user->load(['team']);

        return $this->successResponse([
            'user' => $user
        ]);
    }

    /**
     * Valider une clé API
     */
    public function validateKey(Request $request)
    {
        try {
            $request->validate([
                'api_key' => 'required|string|size:12',
                'team_id' => 'required|integer|exists:teams,id',
            ]);

            $apiKey = $request->input('api_key');
            $teamId = $request->input('team_id');

            // Recherche de l'utilisateur par sa clé API et son team
            $user = User::where('api_key', $apiKey)
                ->where('team_id', $teamId)
                ->where('statut', true)
                ->first();

            if (!$user) {
                return $this->errorResponse('Clé API invalide ou compte inactif.', 401);
            }

            // Récupérer l'team
            $team = Team::where('id', $teamId)
                ->where('statut', true)
                ->first();

            if (!$team) {
                return $this->errorResponse('Team inactif ou inexistant.', 401);
            }

            // Préparer les données à retourner
            $data = [
                'user' => [
                    'id' => $user->id,
                    'nom' => $user->nom,
                    'prenom' => $user->prenom,
                    'email' => $user->email,
                    'telephone' => $user->telephone,
                ],
                'team' => [
                    'id' => $team->id,
                    'nom' => $team->nom,
                    'couleur_primaire' => $team->couleur_primaire,
                ]
            ];

            return $this->successResponse($data, 'Authentification réussie.');
        } catch (\Exception $e) {
            Log::error('Erreur d\'authentification: ' . $e->getMessage());
            return $this->errorResponse('Une erreur est survenue lors de l\'authentification.', 500);
        }
    }

    /**
     * Générer une nouvelle clé API
     */
    public function generateKey(Request $request)
    {
        try {
            // Validation des entrées
            $request->validate([
                'nom' => 'required|string|max:255',
                'prenom' => 'required|string|max:255',
                'email' => 'required|email|max:255',
                'team_id' => 'required|integer|exists:teams,id',
            ]);

            $teamId = $request->input('team_id');
            $email = $request->input('email');

            // Vérifier que l'email n'est pas déjà utilisé dans cette team
            $existingUser = User::where('email', $email)
                ->where('team_id', $teamId)
                ->first();

            if ($existingUser) {
                return $this->errorResponse('Cet email est déjà utilisé dans cette team.', 422);
            }

            // Générer une clé API unique
            $apiKey = Str::random(64);

            // Créer le nouvel utilisateur
            $user = new User();
            $user->nom = $request->input('nom');
            $user->prenom = $request->input('prenom');
            $user->email = $email;
            $user->telephone = $request->input('telephone');
            $user->team_id = $teamId;
            $user->password = Hash::make(Str::random(16)); // Mot de passe aléatoire car non utilisé
            $user->api_key = $apiKey;
            $user->statut = true;
            $user->save();

            return $this->successResponse(
                [
                    'user_id' => $user->id,
                    'api_key' => $apiKey
                ],
                'Clé API générée avec succès.'
            );
        } catch (\Exception $e) {
            Log::error('Erreur de génération de clé API: ' . $e->getMessage());
            return $this->errorResponse('Une erreur est survenue lors de la génération de la clé API.', 500);
        }
    }

    /**
     * Révoquer une clé API (désactiver un utilisateur)
     */
    public function revokeKey(Request $request)
    {
        try {
            $request->validate([
                'user_id' => 'required|integer|exists:users,id',
            ]);

            $userId = $request->input('user_id');
            $user = User::find($userId);

            // Désactiver l'utilisateur
            $user->statut = false;
            $user->save();

            return $this->successResponse(null, 'Clé API révoquée avec succès.');
        } catch (\Exception $e) {
            Log::error('Erreur de révocation de clé API: ' . $e->getMessage());
            return $this->errorResponse('Une erreur est survenue lors de la révocation de la clé API.', 500);
        }
    }
}
