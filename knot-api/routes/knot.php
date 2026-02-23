<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\TeamController;
use App\Http\Controllers\Api\ProjetController;
use App\Http\Controllers\Api\NoteController;
use App\Http\Controllers\Api\CommentaireController;
use App\Http\Controllers\Api\ReactionController;
use App\Http\Controllers\Api\SyncController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\TacheController;

// Routes sans authentification
Route::post('/auth/validate-key', [AuthController::class, 'validateKey']);
Route::post('/teams/validate-code', [TeamController::class, 'validateCode']);

// Routes avec authentification par API Key
Route::middleware('auth.api')->group(function () {
    // Routes Teams
    Route::get('/teams', [TeamController::class, 'index']);
    Route::post('/teams', [TeamController::class, 'store']);
    Route::get('/teams/{id}', [TeamController::class, 'show']);
    Route::put('/teams/{id}', [TeamController::class, 'update']);
    Route::delete('/teams/{id}', [TeamController::class, 'destroy']);
    Route::post('/teams/generate-code', [TeamController::class, 'generateUniqueCode']);

    // Routes Projets
    Route::get('/projets', [ProjetController::class, 'index']);
    Route::post('/projets', [ProjetController::class, 'store']);
    Route::get('/projets/{id}', [ProjetController::class, 'show']);
    Route::put('/projets/{id}', [ProjetController::class, 'update']);
    Route::delete('/projets/{id}', [ProjetController::class, 'destroy']);
    Route::get('/teams/{id}/members', [TeamController::class, 'members']);
    Route::get('/teams/{id}/projets', [ProjetController::class, 'getByTeam']);

    // Routes Notes
    Route::get('/notes', [NoteController::class, 'index']);
    Route::post('/notes', [NoteController::class, 'store']);
    Route::get('/notes/{id}', [NoteController::class, 'show']);
    Route::put('/notes/{id}', [NoteController::class, 'update']);
    Route::delete('/notes/{id}', [NoteController::class, 'destroy']);
    Route::get('/projets/{id}/notes', [NoteController::class, 'getByProjet']);
    Route::get('/teams/{id}/notes', [NoteController::class, 'getByTeam']);
    Route::put('/notes/{id}/sync-status', [NoteController::class, 'updateSyncStatus']);

    // Routes Tâches
    Route::get('/taches', [TacheController::class, 'index']);
    Route::post('/taches', [TacheController::class, 'store']);
    Route::get('/taches/{id}', [TacheController::class, 'show']);
    Route::put('/taches/{id}', [TacheController::class, 'update']);
    Route::delete('/taches/{id}', [TacheController::class, 'destroy']);
    Route::get('/projets/{id}/taches', [TacheController::class, 'getByProjet']);
    Route::get('/teams/{id}/taches', [TacheController::class, 'getByTeam']);
    Route::put('/taches/{id}/sync-status', [TacheController::class, 'updateSyncStatus']);

    // Routes Commentaires
    Route::get('/commentaires', [CommentaireController::class, 'index']);
    Route::post('/commentaires', [CommentaireController::class, 'store']);
    Route::get('/commentaires/{id}', [CommentaireController::class, 'show']);
    Route::put('/commentaires/{id}', [CommentaireController::class, 'update']);
    Route::delete('/commentaires/{id}', [CommentaireController::class, 'destroy']);
    Route::get('/notes/{id}/commentaires', [CommentaireController::class, 'getByNote']);
    Route::put('/commentaires/{id}/sync-status', [CommentaireController::class, 'updateSyncStatus']);

    // Routes Réactions
    Route::get('/reactions', [ReactionController::class, 'index']);
    Route::post('/reactions', [ReactionController::class, 'store']);
    Route::get('/reactions/{id}', [ReactionController::class, 'show']);
    Route::put('/reactions/{id}', [ReactionController::class, 'update']);
    Route::delete('/reactions/{id}', [ReactionController::class, 'destroy']);
    Route::get('/commentaires/{id}/reactions', [ReactionController::class, 'getByCommentaire']);
    Route::post('/reactions/toggle', [ReactionController::class, 'toggle']);
    Route::put('/reactions/{id}/sync-status', [ReactionController::class, 'updateSyncStatus']);

    // Routes Synchronisation
    Route::post('/sync', [SyncController::class, 'sync']);
    Route::get('/sync/status', [SyncController::class, 'status']);

    // Routes Authentification
    Route::post('/auth/generate-key', [AuthController::class, 'generateKey']);
    Route::post('/auth/revoke-key', [AuthController::class, 'revokeKey']);
});
