<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class TexteLoi
 * 
 * @property int $id
 * @property string $titre
 * @property string $disposition
 * @property string $lire
 * @property string $lien
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 *
 * @package App\Models
 */
class TexteLoi extends Model
{
	protected $table = 'texte_lois';

	protected $fillable = [
		'titre',
		'disposition',
		'lire',
		'lien'
	];
}
