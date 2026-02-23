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
        Schema::create('reactions', function (Blueprint $table) {
            $table->id();
            $table->string('type')->comment('Type d\'emoji: 👍, ✅, ⚠️, etc.');
            $table->unsignedBigInteger('commentaire_id');
            $table->unsignedBigInteger('auteur_id');
            $table->unsignedBigInteger('team_id');
            $table->uuid('sync_id')->unique()->comment('Identifiant pour la synchronisation');
            $table->enum('sync_status', ['pending', 'synced'])->default('synced');
            $table->timestamps();

            $table->foreign('commentaire_id')->references('id')->on('commentaires')->onDelete('cascade');
            $table->foreign('auteur_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('team_id')->references('id')->on('teams')->onDelete('cascade');

            // Une seule réaction par type par commentaire et par utilisateur
            $table->unique(['type', 'commentaire_id', 'auteur_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reactions');
    }
};