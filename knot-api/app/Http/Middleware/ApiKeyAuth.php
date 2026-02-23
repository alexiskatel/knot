<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\User;

class ApiKeyAuth
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        $apiKey = $request->header('X-API-KEY');
        $teamId = $request->header('X-TEAM-ID');

        if (!$apiKey || !$teamId) {
            return response()->json([
                'success' => false,
                'message' => 'Clé API ou ID de team manquant.',
                'timestamp' => now()->toISOString()
            ], 401);
        }

        // Recherche de l'utilisateur par sa clé API et son team
        $user = User::where('api_key', $apiKey)
            ->where('team_id', $teamId)
            ->where('statut', true)
            ->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Authentification invalide.',
                'timestamp' => now()->toISOString()
            ], 401);
        }

        // Ajouter l'utilisateur à la requête
        $request->attributes->add(['api_user' => $user]);

        return $next($request);
    }
}