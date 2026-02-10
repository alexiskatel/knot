<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Definition
 * 
 * @property int $id
 * @property string $titre
 * @property string $contenu
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 *
 * @package App\Models
 */
class Definition extends Model
{
	protected $table = 'definitions';

	protected $fillable = [
		'titre',
		'contenu'
	];
}
