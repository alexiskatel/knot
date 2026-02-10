<?php

use Illuminate\Support\Facades\Route;

Route::get('/sanctum/csrf-cookie', function () {
    return response()->json(['message' => 'CSRF cookie set']);
});


Route::prefix('v1')->group(function () {
    Route::middleware('auth:sanctum')->group(function () {
        // require __DIR__ . '/test.php';
    });

    require __DIR__ . '/auth.php';
});
