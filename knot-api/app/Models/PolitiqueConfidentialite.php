<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class PolitiqueConfidentialite
 * 
 * @property int $id
 * @property string $titre
 * @property string $slug
 * @property string $content
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 *
 * @package App\Models
 */
class PolitiqueConfidentialite extends Model
{
	protected $table = 'politique_confidentialites';

	protected $fillable = [
		'titre',
		'slug',
		'content'
	];
}
