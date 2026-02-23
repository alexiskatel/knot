<?php

use Illuminate\Support\Facades\Route;

Route::get('/sanctum/csrf-cookie', function () {
    return response()->json(['message' => 'CSRF cookie set']);
});

Route::prefix('v1')->group(function () {
    // Routes d'authentification Sanctum (login, logout)
    require __DIR__ . '/auth.php';

    // Routes de l'application Knot
    require __DIR__ . '/knot.php';

    // Routes protégées par Sanctum (interface d'admin)
    Route::middleware('auth:sanctum')->group(function () {
        // Routes admin (à implémenter ultérieurement)
    });
});
