<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Team extends Model
{
    use HasFactory;

    protected $table = 'teams';

    protected $fillable = [
        'nom',
        'code_unique',
        'couleur_primaire',
        'description',
        'logo_id',
        'statut'
    ];

    protected $casts = [
        'statut' => 'boolean',
    ];

    /**
     * Récupère le logo du team
     */
    public function logo(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'logo_id');
    }

    /**
     * Récupère les utilisateurs du team
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'team_id');
    }

    /**
     * Récupère les projets du team
     */
    public function projets(): HasMany
    {
        return $this->hasMany(Projet::class, 'team_id');
    }

    /**
     * Récupère les notes du team
     */
    public function notes(): HasMany
    {
        return $this->hasMany(Note::class, 'team_id');
    }

    /**
     * Récupère les médias du team
     */
    public function medias(): HasMany
    {
        return $this->hasMany(Media::class, 'team_id');
    }
}
