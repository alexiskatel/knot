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
        Schema::create('entreprises', function (Blueprint $table) {
            $table->id();
            $table->string('nom');
            $table->string('code_unique')->unique()->comment('Code unique pour l\'identification de l\'entreprise');
            $table->string('couleur_primaire')->default('#2F3C73');
            $table->text('description')->nullable();
            $table->unsignedBigInteger('logo_id')->nullable();
            $table->boolean('statut')->default(true);
            $table->timestamps();

            $table->foreign('logo_id')->references('id')->on('medias')->onDelete('set null');
        });

        // Ajout de la colonne entreprise_id à la table users
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('entreprise_id')->nullable()->after('role_id');
            $table->string('api_key')->nullable()->unique()->after('password');

            $table->foreign('entreprise_id')->references('id')->on('entreprises')->onDelete('set null');

            // Modification du champ email pour ne pas être unique globalement, mais par entreprise
            $table->dropUnique(['email']);
            $table->unique(['email', 'entreprise_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['entreprise_id']);
            $table->dropUnique(['email', 'entreprise_id']);
            $table->unique(['email']);
            $table->dropColumn(['entreprise_id', 'api_key']);
        });

        Schema::dropIfExists('entreprises');
    }
};