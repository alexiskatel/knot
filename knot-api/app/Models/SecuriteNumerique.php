<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class SecuriteNumerique
 * 
 * @property int $id
 * @property string $titre
 * @property string $contenu
 * @property int $image_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Media $media
 *
 * @package App\Models
 */
class SecuriteNumerique extends Model
{
	protected $table = 'securite_numeriques';

	protected $casts = [
		'image_id' => 'int'
	];

	protected $fillable = [
		'titre',
		'contenu',
		'image_id'
	];

	public function media()
	{
		return $this->belongsTo(Media::class, 'image_id');
	}
}
