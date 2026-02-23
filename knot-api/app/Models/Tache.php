<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Tache extends Model
{
    use HasFactory;

    protected $table = 'taches';

    protected $fillable = [
        'titre',
        'description',
        'statut',
        'assigne_id',
        'due_date',
        'projet_id',
        'auteur_id',
        'team_id',
        'sync_id',
        'sync_status',
    ];

    protected $casts = [
        'assigne_id' => 'integer',
        'projet_id'  => 'integer',
        'auteur_id'  => 'integer',
        'team_id'    => 'integer',
        'due_date'   => 'date',
    ];

    /**
     * Récupère le projet associé à la tâche
     */
    public function projet(): BelongsTo
    {
        return $this->belongsTo(Projet::class);
    }

    /**
     * Récupère l'auteur de la tâche
     */
    public function auteur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'auteur_id');
    }

    /**
     * Récupère le membre assigné à la tâche
     */
    public function assigne(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigne_id');
    }

    /**
     * Récupère le team de la tâche
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * Génère un sync_id unique lors de la création du modèle
     */
    protected static function booted()
    {
        static::creating(function ($tache) {
            if (!$tache->sync_id) {
                $tache->sync_id = (string) \Illuminate\Support\Str::uuid();
            }
        });
    }
}
