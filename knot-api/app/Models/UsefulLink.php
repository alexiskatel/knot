<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class UsefulLink
 * 
 * @property int $id
 * @property string $nom
 * @property string $link
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 *
 * @package App\Models
 */
class UsefulLink extends Model
{
	protected $table = 'useful_links';

	protected $fillable = [
		'nom',
		'link'
	];
}
