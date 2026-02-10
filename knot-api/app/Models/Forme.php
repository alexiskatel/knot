<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Forme
 * 
 * @property int $id
 * @property string $nom
 * @property string $description
 * @property int $image_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Media $media
 *
 * @package App\Models
 */
class Forme extends Model
{
	protected $table = 'formes';

	protected $casts = [
		'image_id' => 'int'
	];

	protected $fillable = [
		'nom',
		'description',
		'image_id'
	];

	public function media()
	{
		return $this->belongsTo(Media::class, 'image_id');
	}
}
