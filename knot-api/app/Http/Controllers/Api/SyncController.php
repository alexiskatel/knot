<?php

namespace App\Http\Controllers\Api;

use App\Models\Note;
use App\Models\Projet;
use App\Models\Tache;
use App\Models\Commentaire;
use App\Models\Reaction;
use App\Models\User;
use App\Models\Team;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SyncController extends Controller
{
    /**
     * Synchroniser les données
     */
    public function sync(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'team_id' => 'required|integer|exists:teams,id',
                'user_id' => 'required|integer|exists:users,id',
                'last_sync_date' => 'nullable|date',
                'data' => 'nullable|array',
                'data.projets' => 'nullable|array',
                'data.notes' => 'nullable|array',
                'data.taches' => 'nullable|array',
                'data.commentaires' => 'nullable|array',
                'data.reactions' => 'nullable|array',
            ]);

            $teamId = $request->input('team_id');
            $userId = $request->input('user_id');
            $lastSyncDate = $request->input('last_sync_date');
            $data = $request->input('data', []);

            // Vérifier que l'utilisateur appartient au team
            $user = User::where('id', $userId)
                ->where('team_id', $teamId)
                ->where('statut', true)
                ->first();

            if (!$user) {
                return $this->errorResponse('Utilisateur non autorisé.', 403);
            }

            // 1. Processus de synchronisation bidirectionnelle
            $result = DB::transaction(function () use ($teamId, $userId, $lastSyncDate, $data) {
                $syncResult = [
                    'uploaded' => [
                        'projets' => 0,
                        'notes' => 0,
                        'taches' => 0,
                        'commentaires' => 0,
                        'reactions' => 0,
                    ],
                    'downloaded' => [
                        'projets' => [],
                        'notes' => [],
                        'taches' => [],
                        'commentaires' => [],
                        'reactions' => [],
                    ],
                ];

                // 2. Traiter les données envoyées par le client (upload)
                $syncResult['uploaded'] = $this->processClientData($data, $teamId, $userId);

                // 3. Récupérer les données pour le client (download)
                $syncResult['downloaded'] = $this->getServerData($lastSyncDate, $teamId);

                // 4. Mettre à jour la date de dernière synchronisation de l'utilisateur
                $user = User::find($userId);
                $user->last_sync_date = now();
                $user->save();

                return $syncResult;
            });

            return $this->successResponse($result, 'Synchronisation réussie.');
        } catch (\Exception $e) {
            Log::error('Erreur de synchronisation: ' . $e->getMessage());
            return $this->errorResponse('Une erreur est survenue lors de la synchronisation: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Traiter les données envoyées par le client
     */
    private function processClientData(array $data, int $teamId, int $userId): array
    {
        $counts = [
            'projets' => 0,
            'notes' => 0,
            'taches' => 0,
            'commentaires' => 0,
            'reactions' => 0,
        ];

        // Traiter les projets
        if (isset($data['projets']) && is_array($data['projets'])) {
            foreach ($data['projets'] as $projetData) {
                if (isset($projetData['sync_id'])) {
                    $projet = Projet::where('sync_id', $projetData['sync_id'])->first();

                    // Si le projet existe, le mettre à jour, sinon le créer
                    if ($projet) {
                        $projet->update(array_merge($projetData, ['team_id' => $teamId]));
                    } else {
                        Projet::create(array_merge($projetData, ['team_id' => $teamId]));
                    }
                    $counts['projets']++;
                }
            }
        }

        // Traiter les tâches
        if (isset($data['taches']) && is_array($data['taches'])) {
            foreach ($data['taches'] as $tacheData) {
                if (isset($tacheData['sync_id'])) {
                    $tache = Tache::where('sync_id', $tacheData['sync_id'])->first();

                    if ($tache) {
                        $tache->update(array_merge($tacheData, ['team_id' => $teamId]));
                    } else {
                        Tache::create(array_merge($tacheData, [
                            'team_id'     => $teamId,
                            'sync_status' => 'synced'
                        ]));
                    }
                    $counts['taches']++;
                }
            }
        }

        // Traiter les notes
        if (isset($data['notes']) && is_array($data['notes'])) {
            foreach ($data['notes'] as $noteData) {
                if (isset($noteData['sync_id'])) {
                    $note = Note::where('sync_id', $noteData['sync_id'])->first();

                    // Si la note existe, la mettre à jour, sinon la créer
                    if ($note) {
                        $note->update(array_merge($noteData, ['team_id' => $teamId]));
                    } else {
                        Note::create(array_merge($noteData, [
                            'team_id' => $teamId,
                            'sync_status' => 'synced'
                        ]));
                    }
                    $counts['notes']++;
                }
            }
        }

        // Traiter les commentaires
        if (isset($data['commentaires']) && is_array($data['commentaires'])) {
            foreach ($data['commentaires'] as $commentaireData) {
                if (isset($commentaireData['sync_id'])) {
                    $commentaire = Commentaire::where('sync_id', $commentaireData['sync_id'])->first();

                    // Si le commentaire existe, le mettre à jour, sinon le créer
                    if ($commentaire) {
                        $commentaire->update(array_merge($commentaireData, ['team_id' => $teamId]));
                    } else {
                        Commentaire::create(array_merge($commentaireData, [
                            'team_id' => $teamId,
                            'sync_status' => 'synced'
                        ]));
                    }
                    $counts['commentaires']++;
                }
            }
        }

        // Traiter les réactions
        if (isset($data['reactions']) && is_array($data['reactions'])) {
            foreach ($data['reactions'] as $reactionData) {
                if (isset($reactionData['sync_id'])) {
                    $reaction = Reaction::where('sync_id', $reactionData['sync_id'])->first();

                    // Si la réaction existe, la mettre à jour, sinon la créer
                    if ($reaction) {
                        $reaction->update(array_merge($reactionData, ['team_id' => $teamId]));
                    } else {
                        // Vérifier s'il n'existe pas déjà une réaction du même type de cet auteur pour ce commentaire
                        $existingReaction = Reaction::where('type', $reactionData['type'])
                            ->where('commentaire_id', $reactionData['commentaire_id'])
                            ->where('auteur_id', $reactionData['auteur_id'])
                            ->first();

                        if (!$existingReaction) {
                            Reaction::create(array_merge($reactionData, [
                                'team_id' => $teamId,
                                'sync_status' => 'synced'
                            ]));
                            $counts['reactions']++;
                        }
                    }
                }
            }
        }

        return $counts;
    }

    /**
     * Récupérer les données du serveur pour le client
     */
    private function getServerData(?string $lastSyncDate, int $teamId): array
    {
        $data = [
            'projets' => [],
            'notes' => [],
            'taches' => [],
            'commentaires' => [],
            'reactions' => [],
        ];

        // Si la date de dernière synchronisation n'est pas fournie, récupérer toutes les données
        $query = $lastSyncDate
            ? function ($q) use ($lastSyncDate) { $q->where('updated_at', '>', $lastSyncDate); }
            : function ($q) { return $q; };

        // Récupérer les projets
        $data['projets'] = Projet::where('team_id', $teamId)
            ->where($query)
            ->get();

        // Récupérer les tâches
        $data['taches'] = Tache::where('team_id', $teamId)
            ->where($query)
            ->get();

        // Récupérer les notes
        $data['notes'] = Note::where('team_id', $teamId)
            ->where($query)
            ->get();

        // Récupérer les commentaires
        $data['commentaires'] = Commentaire::where('team_id', $teamId)
            ->where($query)
            ->get();

        // Récupérer les réactions
        $data['reactions'] = Reaction::where('team_id', $teamId)
            ->where($query)
            ->get();

        return $data;
    }

    /**
     * Vérifier le statut de synchronisation
     */
    public function status(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'team_id' => 'required|integer|exists:teams,id',
                'user_id' => 'required|integer|exists:users,id',
            ]);

            $teamId = $request->input('team_id');

            // Compter les éléments non synchronisés
            $pendingNotes = Note::where('team_id', $teamId)
                ->where('sync_status', 'pending')
                ->count();

            $pendingCommentaires = Commentaire::where('team_id', $teamId)
                ->where('sync_status', 'pending')
                ->count();

            $pendingReactions = Reaction::where('team_id', $teamId)
                ->where('sync_status', 'pending')
                ->count();

            $result = [
                'pending_items' => $pendingNotes + $pendingCommentaires + $pendingReactions,
                'details' => [
                    'notes' => $pendingNotes,
                    'commentaires' => $pendingCommentaires,
                    'reactions' => $pendingReactions,
                ],
                'last_sync' => User::find($request->user_id)->last_sync_date,
            ];

            return $this->successResponse($result, 'Statut de synchronisation récupéré avec succès.');
        } catch (\Exception $e) {
            Log::error('Erreur de récupération du statut de synchronisation: ' . $e->getMessage());
            return $this->errorResponse('Une erreur est survenue lors de la récupération du statut de synchronisation: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Format de réponse réussie
     */
    protected function successResponse($data, string $message = '', int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'list' => $data,
            'timestamp' => now()->toISOString()
        ], $status);
    }

    /**
     * Format de réponse d'erreur
     */
    protected function errorResponse(string $message, int $status = 400, $errors = null): JsonResponse
    {
        $response = [
            'success' => false,
            'message' => $message,
            'timestamp' => now()->toISOString()
        ];

        if ($errors) {
            $response['errors'] = $errors;
        }

        return response()->json($response, $status);
    }
}