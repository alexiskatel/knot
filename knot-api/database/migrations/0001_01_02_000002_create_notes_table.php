<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('notes', function (Blueprint $table) {
            $table->id();
            $table->string('titre');
            $table->longText('contenu');
            $table->enum('statut', ['brouillon', 'publié', 'archivé'])->default('publié');
            $table->unsignedBigInteger('projet_id');
            $table->unsignedBigInteger('auteur_id');
            $table->unsignedBigInteger('team_id');
            $table->uuid('sync_id')->unique()->comment('Identifiant pour la synchronisation');
            $table->enum('sync_status', ['pending', 'synced'])->default('synced');
            $table->timestamps();

            $table->foreign('projet_id')->references('id')->on('projets')->onDelete('cascade');
            $table->foreign('auteur_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('team_id')->references('id')->on('teams')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notes');
    }
};