<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Reaction extends Model
{
    use HasFactory;

    protected $table = 'reactions';

    protected $fillable = [
        'type',
        'commentaire_id',
        'auteur_id',
        'team_id',
        'sync_id',
        'sync_status'
    ];

    protected $casts = [
        'commentaire_id' => 'integer',
        'auteur_id' => 'integer',
        'team_id' => 'integer'
    ];

    /**
     * Récupère le commentaire associé à la réaction
     */
    public function commentaire(): BelongsTo
    {
        return $this->belongsTo(Commentaire::class);
    }

    /**
     * Récupère l'auteur de la réaction
     */
    public function auteur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'auteur_id');
    }

    /**
     * Récupère le team de la réaction
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
        static::creating(function ($reaction) {
            if (!$reaction->sync_id) {
                $reaction->sync_id = (string) \Illuminate\Support\Str::uuid();
            }
        });
    }
}