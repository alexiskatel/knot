<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Banniere
 * 
 * @property int $id
 * @property string $titre
 * @property string $description
 * @property int $image_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Media $media
 *
 * @package App\Models
 */
class Banniere extends Model
{
	protected $table = 'bannieres';

	protected $casts = [
		'image_id' => 'int'
	];

	protected $fillable = [
		'titre',
		'description',
		'image_id'
	];

	public function media()
	{
		return $this->belongsTo(Media::class, 'image_id');
	}
}
