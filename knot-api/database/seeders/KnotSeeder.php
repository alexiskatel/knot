<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use App\Models\Team;
use App\Models\User;
use App\Models\Projet;

class KnotSeeder extends Seeder
{
    public function run(): void
    {
        // ── Team ────────────────────────────────────────────────────────────
        $team = Team::create([
            'nom'              => 'Mon Team',
            'code_unique'      => 'KNOT-DEMO',
            'couleur_primaire' => '#2F3C73',
            'description'      => 'Team de démonstration',
            'statut'           => true,
        ]);

        // ── Utilisateurs ────────────────────────────────────────────────────
        // Clés fixes pour le développement (64 caractères)
        $apiKey1 = 'KADMIN000001';
        $user1 = User::create([
            'nom'         => 'Admin',
            'prenom'      => 'Demo',
            'email'       => 'admin@knot.app',
            'password'    => Hash::make(Str::random(16)),
            'api_key'     => $apiKey1,
            'team_id'     => $team->id,
            'statut'      => true,
        ]);

        $apiKey2 = 'KMARIE000001';
        $user2 = User::create([
            'nom'         => 'Dupont',
            'prenom'      => 'Marie',
            'email'       => 'marie@knot.app',
            'password'    => Hash::make(Str::random(16)),
            'api_key'     => $apiKey2,
            'team_id'     => $team->id,
            'statut'      => true,
        ]);

        // ── Projets ─────────────────────────────────────────────────────────
        $projet1 = Projet::create([
            'titre'       => 'Refonte site web',
            'description' => 'Nouveau design et nouvelles fonctionnalités',
            'couleur'     => '#6C63FF',
            'statut'      => true,
            'team_id'     => $team->id,
        ]);

        $projet2 = Projet::create([
            'titre'       => 'Application mobile',
            'description' => 'Version iOS et Android',
            'couleur'     => '#10B981',
            'statut'      => true,
            'team_id'     => $team->id,
        ]);

        $projet3 = Projet::create([
            'titre'       => 'Marketing Q2',
            'description' => 'Campagne et contenu',
            'couleur'     => '#F59E0B',
            'statut'      => true,
            'team_id'     => $team->id,
        ]);

        // ── Notes ────────────────────────────────────────────────────────────
        $notes = [
            [
                'titre'      => 'Réunion de lancement',
                'contenu'    => "Points abordés :\n- Définition du périmètre\n- Planning des sprints\n- Attribution des rôles\n\nProchaine réunion vendredi 10h.",
                'projet_id'  => $projet1->id,
                'auteur_id'  => $user1->id,
            ],
            [
                'titre'      => 'Maquettes validées',
                'contenu'    => "Les maquettes Figma ont été validées par le client.\n\nModifications demandées :\n- Changer la couleur du header\n- Agrandir les boutons CTA\n- Revoir la typographie mobile",
                'projet_id'  => $projet1->id,
                'auteur_id'  => $user2->id,
            ],
            [
                'titre'      => 'Architecture technique',
                'contenu'    => "Stack retenu :\n- Backend : Laravel 12 API REST\n- Mobile : React Native + Expo\n- DB locale : SQLite\n- Sync bidirectionnelle",
                'projet_id'  => $projet2->id,
                'auteur_id'  => $user1->id,
            ],
            [
                'titre'      => 'Bugs à corriger',
                'contenu'    => "Liste des bugs sprint 2 :\n1. Crash au démarrage sur Android 12\n2. Perte de données hors ligne\n3. Lenteur liste notes > 100 éléments",
                'projet_id'  => $projet2->id,
                'auteur_id'  => $user2->id,
            ],
            [
                'titre'      => 'Idées contenu réseaux sociaux',
                'contenu'    => "Idées pour avril :\n- Thread Twitter sur notre process\n- Vidéo behind the scenes\n- Article blog \"comment on construit Knot\"\n- Newsletter mensuelle",
                'projet_id'  => $projet3->id,
                'auteur_id'  => $user1->id,
            ],
        ];

        foreach ($notes as $noteData) {
            \App\Models\Note::create(array_merge($noteData, [
                'statut'     => 'publié',
                'team_id'    => $team->id,
                'sync_status' => 'synced',
            ]));
        }

        // ── Affichage des infos de connexion ─────────────────────────────────
        $this->command->info('');
        $this->command->info('╔══════════════════════════════════════════╗');
        $this->command->info('║         KNOT — Données de test           ║');
        $this->command->info('╠══════════════════════════════════════════╣');
        $this->command->info("║  Code team  : KNOT-DEMO                  ║");
        $this->command->info('╠══════════════════════════════════════════╣');
        $this->command->info("║  Utilisateur 1 : Admin Demo              ║");
        $this->command->info("║  Clé API 1 :                             ║");
        $this->command->info("║  {$apiKey1}  ║");
        $this->command->info('╠══════════════════════════════════════════╣');
        $this->command->info("║  Utilisateur 2 : Marie Dupont            ║");
        $this->command->info("║  Clé API 2 :                             ║");
        $this->command->info("║  {$apiKey2}  ║");
        $this->command->info('╚══════════════════════════════════════════╝');
        $this->command->info('');
    }
}
