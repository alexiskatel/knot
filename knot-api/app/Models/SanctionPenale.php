<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class SanctionPenale
 * 
 * @property int $id
 * @property string $nom
 * @property string $peine
 * @property string $amende
 * @property string $circonstances
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 *
 * @package App\Models
 */
class SanctionPenale extends Model
{
	protected $table = 'sanction_penales';

	protected $fillable = [
		'nom',
		'peine',
		'amende',
		'circonstances'
	];
}
