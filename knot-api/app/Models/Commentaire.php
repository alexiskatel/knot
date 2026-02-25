<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Commentaire extends Model
{
    use HasFactory;

    protected $table = 'commentaires';

    protected $fillable = [
        'contenu',
        'type',
        'note_id',
        'tache_id',
        'auteur_id',
        'team_id',
        'sync_id',
        'sync_status'
    ];

    protected $casts = [
        'note_id' => 'integer',
        'tache_id' => 'integer',
        'auteur_id' => 'integer',
        'team_id' => 'integer'
    ];

    /**
     * Récupère la note associée au commentaire
     */
    public function note(): BelongsTo
    {
        return $this->belongsTo(Note::class);
    }

    /**
     * Récupère la tâche associée au commentaire
     */
    public function tache(): BelongsTo
    {
        return $this->belongsTo(Tache::class);
    }

    /**
     * Récupère l'auteur du commentaire
     */
    public function auteur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'auteur_id');
    }

    /**
     * Récupère le team du commentaire
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * Récupère les réactions du commentaire
     */
    public function reactions(): HasMany
    {
        return $this->hasMany(Reaction::class);
    }

    /**
     * Récupère les médias associés au commentaire
     */
    public function medias(): MorphMany
    {
        return $this->morphMany(Media::class, 'model');
    }

    /**
     * Génère un sync_id unique lors de la création du modèle
     */
    protected static function booted()
    {
        static::creating(function ($commentaire) {
            if (!$commentaire->sync_id) {
                $commentaire->sync_id = (string) \Illuminate\Support\Str::uuid();
            }
        });
    }
}