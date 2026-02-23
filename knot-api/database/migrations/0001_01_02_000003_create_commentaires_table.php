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
        Schema::create('commentaires', function (Blueprint $table) {
            $table->id();
            $table->text('contenu');
            $table->enum('type', ['texte', 'audio'])->default('texte');
            $table->unsignedBigInteger('note_id');
            $table->unsignedBigInteger('auteur_id');
            $table->unsignedBigInteger('team_id');
            $table->uuid('sync_id')->unique()->comment('Identifiant pour la synchronisation');
            $table->enum('sync_status', ['pending', 'synced'])->default('synced');
            $table->timestamps();

            $table->foreign('note_id')->references('id')->on('notes')->onDelete('cascade');
            $table->foreign('auteur_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('team_id')->references('id')->on('teams')->onDelete('cascade');
        });

        // Ajout de la colonne polymorphique dans la table medias
        Schema::table('medias', function (Blueprint $table) {
            $table->string('model_type')->nullable()->after('collection');
            $table->unsignedBigInteger('model_id')->nullable()->after('model_type');
            $table->index(['model_type', 'model_id']);

            // Ajout du champ team_id
            $table->unsignedBigInteger('team_id')->nullable()->after('model_id');
            $table->foreign('team_id')->references('id')->on('teams')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('medias', function (Blueprint $table) {
            $table->dropIndex(['model_type', 'model_id']);
            $table->dropForeign(['team_id']);
            $table->dropColumn(['model_type', 'model_id', 'team_id']);
        });

        Schema::dropIfExists('commentaires');
    }
};