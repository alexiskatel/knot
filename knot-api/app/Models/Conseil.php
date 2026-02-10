<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Conseil
 * 
 * @property int $id
 * @property string $nom
 * @property int $type_conseil_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property TypeConseil $type_conseil
 *
 * @package App\Models
 */
class Conseil extends Model
{
	protected $table = 'conseils';

	protected $casts = [
		'type_conseil_id' => 'int'
	];

	protected $fillable = [
		'nom',
		'type_conseil_id'
	];

	public function type_conseil()
	{
		return $this->belongsTo(TypeConseil::class);
	}
}
