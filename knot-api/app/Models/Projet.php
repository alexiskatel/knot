<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class Projet extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'projets';

    protected $fillable = [
        'titre',
        'description',
        'couleur',
        'statut',
        'team_id',
        'sync_id',
        'deleted_by',
    ];

    protected $casts = [
        'statut'     => 'boolean',
        'team_id'    => 'integer',
        'deleted_by' => 'integer',
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
     * Récupère l'utilisateur qui a supprimé le projet
     */
    public function deletedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }

    /**
     * Génère un sync_id unique lors de la création du modèle
     * et cascade le soft-delete sur les notes et tâches associées
     */
    protected static function booted()
    {
        static::creating(function ($projet) {
            if (!$projet->sync_id) {
                $projet->sync_id = (string) \Illuminate\Support\Str::uuid();
            }
        });

        static::deleting(function (Projet $projet) {
            $deletedBy = $projet->deleted_by;
            if ($deletedBy) {
                $projet->notes()->update(['deleted_by' => $deletedBy]);
                $projet->taches()->update(['deleted_by' => $deletedBy]);
            }
            $projet->notes()->delete();
            $projet->taches()->delete();
        });
    }
}