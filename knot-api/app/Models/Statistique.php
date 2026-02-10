<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Statistique
 * 
 * @property int $id
 * @property int $valeur
 * @property string $description
 * @property string $color
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 *
 * @package App\Models
 */
class Statistique extends Model
{
	protected $table = 'statistiques';

	protected $casts = [
		'valeur' => 'int'
	];

	protected $fillable = [
		'valeur',
		'description',
		'color'
	];
}
