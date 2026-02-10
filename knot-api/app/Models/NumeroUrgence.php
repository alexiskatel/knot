<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class NumeroUrgence
 * 
 * @property int $id
 * @property string $nom
 * @property string $numero
 * @property int $image_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Media $media
 *
 * @package App\Models
 */
class NumeroUrgence extends Model
{
	protected $table = 'numero_urgences';

	protected $casts = [
		'image_id' => 'int'
	];

	protected $fillable = [
		'nom',
		'numero',
		'image_id'
	];

	public function media()
	{
		return $this->belongsTo(Media::class, 'image_id');
	}
}
