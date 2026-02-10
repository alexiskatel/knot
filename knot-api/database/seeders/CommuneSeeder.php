<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CommuneSeeder extends Seeder
{
    public function run(): void
    {
        // Sample communes from different departments
        $communes = [
            ['nom' => 'Cotonou', 'departement_id' => 8], // Littoral
            ['nom' => 'Porto-Novo', 'departement_id' => 10], // Ouémé
            ['nom' => 'Parakou', 'departement_id' => 4], // Borgou
            ['nom' => 'Djougou', 'departement_id' => 7], // Donga
            ['nom' => 'Natitingou', 'departement_id' => 2], // Atacora
            ['nom' => 'Abomey', 'departement_id' => 11], // Zou
            ['nom' => 'Lokossa', 'departement_id' => 9], // Mono
            ['nom' => 'Kandi', 'departement_id' => 1], // Alibori
            ['nom' => 'Savé', 'departement_id' => 5], // Collines
            ['nom' => 'Ouidah', 'departement_id' => 3], // Atlantique
        ];

        foreach ($communes as $commune) {
            DB::table('communes')->insert([
                'nom' => $commune['nom'],
                'departement_id' => $commune['departement_id'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
