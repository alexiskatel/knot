<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Institution
 * 
 * @property int $id
 * @property string $nom
 * @property string|null $sigle
 * @property int $image_id
 * @property string|null $description
 * @property string $email
 * @property string $telephone
 * @property int $adresse
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Media $media
 *
 * @package App\Models
 */
class Institution extends Model
{
	protected $table = 'institutions';

	protected $casts = [
		'image_id' => 'int',
		'adresse' => 'int'
	];

	protected $fillable = [
		'nom',
		'sigle',
		'image_id',
		'description',
		'email',
		'telephone',
		'adresse'
	];

	public function media()
	{
		return $this->belongsTo(Media::class, 'image_id');
	}
}
