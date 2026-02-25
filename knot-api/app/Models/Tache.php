<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Liaison;

class Tache extends Model
{
    use HasFactory, SoftDeletes;

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
        'deleted_by',
    ];

    protected $casts = [
        'assigne_id'  => 'integer',
        'projet_id'   => 'integer',
        'auteur_id'   => 'integer',
        'team_id'     => 'integer',
        'due_date'    => 'date',
        'deleted_by'  => 'integer',
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
     * Récupère l'utilisateur qui a supprimé la tâche
     */
    public function deletedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }

    /**
     * Génère un sync_id unique lors de la création du modèle
     * et supprime les liaisons en cascade lors de la suppression
     */
    protected static function booted()
    {
        static::creating(function ($tache) {
            if (!$tache->sync_id) {
                $tache->sync_id = (string) \Illuminate\Support\Str::uuid();
            }
        });

        static::deleting(function (Tache $tache) {
            Liaison::where('source_type', 'tache')->where('source_id', $tache->id)->delete();
            Liaison::where('target_type', 'tache')->where('target_id', $tache->id)->delete();
        });
    }
}
