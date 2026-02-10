<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class StructurePriseEnCharge
 * 
 * @property int $id
 * @property string $nom
 * @property string $description
 * @property int $image_id
 * @property string|null $numero
 * @property string|null $lien
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Media $media
 *
 * @package App\Models
 */
class StructurePriseEnCharge extends Model
{
	protected $table = 'structure_prise_en_charges';

	protected $casts = [
		'image_id' => 'int'
	];

	protected $fillable = [
		'nom',
		'description',
		'image_id',
		'numero',
		'lien'
	];

	public function media()
	{
		return $this->belongsTo(Media::class, 'image_id');
	}
}
