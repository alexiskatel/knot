<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\BaseApiController;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Auth API Controller
 *
 * Gestion de l'authentification avec Laravel Sanctum
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
     * Login user and create token
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

        // Charger les relations nécessaires (nouvelle architecture)
        $user->load(['structure', 'userType', 'validationScopes']);

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

        // Charger les relations nécessaires (nouvelle architecture)
        $user->load(['structure', 'userType', 'validationScopes']);

        return $this->successResponse([
            'user' => $user
        ]);
    }
}
