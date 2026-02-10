<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class HygieneNumerique
 * 
 * @property int $id
 * @property string $titre
 * @property string $conseil
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 *
 * @package App\Models
 */
class HygieneNumerique extends Model
{
	protected $table = 'hygiene_numeriques';

	protected $fillable = [
		'titre',
		'conseil'
	];
}
