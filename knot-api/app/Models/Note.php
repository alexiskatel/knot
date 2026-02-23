<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Note extends Model
{
    use HasFactory;

    protected $table = 'notes';

    protected $fillable = [
        'titre',
        'contenu',
        'statut',
        'projet_id',
        'auteur_id',
        'team_id',
        'sync_id',
        'sync_status'
    ];

    protected $casts = [
        'projet_id' => 'integer',
        'auteur_id' => 'integer',
        'team_id' => 'integer'
    ];

    /**
     * Récupère le projet associé à la note
     */
    public function projet(): BelongsTo
    {
        return $this->belongsTo(Projet::class);
    }

    /**
     * Récupère l'auteur de la note
     */
    public function auteur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'auteur_id');
    }

    /**
     * Récupère le team de la note
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * Récupère les commentaires de la note
     */
    public function commentaires(): HasMany
    {
        return $this->hasMany(Commentaire::class);
    }

    /**
     * Récupère les médias associés à la note
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
        static::creating(function ($note) {
            if (!$note->sync_id) {
                $note->sync_id = (string) \Illuminate\Support\Str::uuid();
            }
        });
    }
}