<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('medias', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Human readable name
            $table->string('file_name'); // Actual file name on disk
            $table->string('mime_type');
            $table->string('path'); // Path to file
            $table->string('disk')->default('public'); // Storage disk
            $table->string('file_hash')->unique(); // Hash for uniqueness
            $table->string('collection')->nullable(); // Optional grouping
            $table->unsignedBigInteger('size');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('medias');
    }
};
