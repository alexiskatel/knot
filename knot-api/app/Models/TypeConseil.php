<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class TypeConseil
 * 
 * @property int $id
 * @property string $nom
 * 
 * @property Collection|Conseil[] $conseils
 *
 * @package App\Models
 */
class TypeConseil extends Model
{
	protected $table = 'type_conseils';
	public $timestamps = false;

	protected $fillable = [
		'nom'
	];

	public function conseils()
	{
		return $this->hasMany(Conseil::class);
	}
}
