<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

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
 * @property bool $statut
 * @property Carbon $date_creation
 * @property int|null $structure_id
 * @property int|null $role_id
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 *
 * @package App\Models
 */
class User extends Model
{
	protected $table = 'users';

	protected $casts = [
		'email_verified_at' => 'datetime',
		'statut' => 'bool',
		'date_creation' => 'datetime',
		'structure_id' => 'int',
		'role_id' => 'int'
	];

	protected $hidden = [
		'password',
		'remember_token'
	];

	protected $fillable = [
		'nom',
		'prenom',
		'email',
		'telephone',
		'email_verified_at',
		'password',
		'statut',
		'date_creation',
		'structure_id',
		'role_id',
		'remember_token'
	];
}
