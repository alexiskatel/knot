<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class ObjetNumerique
 * 
 * @property int $id
 * @property string $nom
 * @property int $image_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Media $media
 *
 * @package App\Models
 */
class ObjetNumerique extends Model
{
	protected $table = 'objet_numeriques';

	protected $casts = [
		'image_id' => 'int'
	];

	protected $fillable = [
		'nom',
		'image_id'
	];

	public function media()
	{
		return $this->belongsTo(Media::class, 'image_id');
	}
}
