<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Sujet
 * 
 * @property int $id
 * @property string $titre
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Collection|Contact[] $contacts
 *
 * @package App\Models
 */
class Sujet extends Model
{
	protected $table = 'sujets';

	protected $fillable = [
		'titre'
	];

	public function contacts()
	{
		return $this->hasMany(Contact::class);
	}
}
