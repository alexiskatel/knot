<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Projet extends Model
{
    use HasFactory;

    protected $table = 'projets';

    protected $fillable = [
        'titre',
        'description',
        'couleur',
        'statut',
        'team_id',
        'sync_id'
    ];

    protected $casts = [
        'statut' => 'boolean',
        'team_id' => 'integer'
    ];

    /**
     * Récupère le team du projet
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * Récupère les notes du projet
     */
    public function notes(): HasMany
    {
        return $this->hasMany(Note::class);
    }

    /**
     * Récupère les tâches du projet
     */
    public function taches(): HasMany
    {
        return $this->hasMany(Tache::class);
    }

    /**
     * Génère un sync_id unique lors de la création du modèle
     */
    protected static function booted()
    {
        static::creating(function ($projet) {
            if (!$projet->sync_id) {
                $projet->sync_id = (string) \Illuminate\Support\Str::uuid();
            }
        });
    }
}