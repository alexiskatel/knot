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
        Schema::create('taches', function (Blueprint $table) {
            $table->id();
            $table->string('titre');
            $table->text('description')->nullable();
            $table->enum('statut', ['todo', 'en_cours', 'done'])->default('todo');
            $table->unsignedBigInteger('projet_id');
            $table->unsignedBigInteger('auteur_id');
            $table->unsignedBigInteger('assigne_id')->nullable();
            $table->unsignedBigInteger('team_id');
            $table->date('due_date')->nullable();
            $table->uuid('sync_id')->unique()->comment('Identifiant pour la synchronisation');
            $table->enum('sync_status', ['pending', 'synced'])->default('synced');
            $table->timestamps();

            $table->foreign('projet_id')->references('id')->on('projets')->onDelete('cascade');
            $table->foreign('auteur_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('assigne_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('team_id')->references('id')->on('teams')->onDelete('cascade');
        });

        // Ajouter la relation tâches au modèle Projet
        Schema::table('projets', function (Blueprint $table) {
            // Rien à modifier — la FK est dans la table taches
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('taches');
    }
};
