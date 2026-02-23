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
        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->string('nom');
            $table->string('code_unique')->unique()->comment('Code unique pour l\'identification du team');
            $table->string('couleur_primaire')->default('#2F3C73');
            $table->text('description')->nullable();
            $table->unsignedBigInteger('logo_id')->nullable();
            $table->boolean('statut')->default(true);
            $table->timestamps();

            $table->foreign('logo_id')->references('id')->on('medias')->onDelete('set null');
        });

        // Ajout de la colonne team_id à la table users
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('team_id')->nullable()->after('role_id');
            $table->string('api_key')->nullable()->unique()->after('password');

            $table->foreign('team_id')->references('id')->on('teams')->onDelete('set null');

            // Email unique par team
            $table->dropUnique(['email']);
            $table->unique(['email', 'team_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['team_id']);
            $table->dropUnique(['email', 'team_id']);
            $table->unique(['email']);
            $table->dropColumn(['team_id', 'api_key']);
        });

        Schema::dropIfExists('teams');
    }
};
