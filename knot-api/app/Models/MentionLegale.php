<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class MentionLegale
 * 
 * @property int $id
 * @property string $titre
 * @property string $slug
 * @property string $contenu
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 *
 * @package App\Models
 */
class MentionLegale extends Model
{
	protected $table = 'mention_legales';

	protected $fillable = [
		'titre',
		'slug',
		'contenu'
	];
}
