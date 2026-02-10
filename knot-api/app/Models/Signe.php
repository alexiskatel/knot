<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Signe
 * 
 * @property int $id
 * @property string $titre
 * @property string|null $description
 * @property string $image
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 *
 * @package App\Models
 */
class Signe extends Model
{
	protected $table = 'signes';

	protected $fillable = [
		'titre',
		'description',
		'image'
	];
}
