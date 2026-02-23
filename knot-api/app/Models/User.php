<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Class User
 *
 * @property int $id
 * @property string $nom
 * @property string $prenom
 * @property string $email
 * @property string|null $telephone
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $api_key
 * @property bool $statut
 * @property Carbon $date_creation
 * @property int|null $structure_id
 * @property int|null $role_id
 * @property int|null $team_id
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $table = 'users';

    protected $casts = [
        'email_verified_at' => 'datetime',
        'statut' => 'bool',
        'date_creation' => 'datetime',
        'structure_id' => 'int',
        'role_id' => 'int',
        'team_id' => 'int'
    ];

    protected $hidden = [
        'password',
        'api_key',
        'remember_token'
    ];

    protected $fillable = [
        'nom',
        'prenom',
        'email',
        'telephone',
        'password',
        'api_key',
        'statut',
        'date_creation',
        'structure_id',
        'role_id',
        'team_id'
    ];

    /**
     * Récupère le team de l'utilisateur
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * Récupère les notes de l'utilisateur
     */
    public function notes(): HasMany
    {
        return $this->hasMany(Note::class, 'auteur_id');
    }

    /**
     * Récupère les commentaires de l'utilisateur
     */
    public function commentaires(): HasMany
    {
        return $this->hasMany(Commentaire::class, 'auteur_id');
    }

    /**
     * Récupère les réactions de l'utilisateur
     */
    public function reactions(): HasMany
    {
        return $this->hasMany(Reaction::class, 'auteur_id');
    }
}