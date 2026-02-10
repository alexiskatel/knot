<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Contact
 * 
 * @property int $id
 * @property string $nom_complet
 * @property string $telephone
 * @property string $email
 * @property int $sujet_id
 * @property string $message
 * @property Carbon $date_envoi
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Sujet $sujet
 *
 * @package App\Models
 */
class Contact extends Model
{
	protected $table = 'contacts';

	protected $casts = [
		'sujet_id' => 'int',
		'date_envoi' => 'datetime'
	];

	protected $fillable = [
		'nom_complet',
		'telephone',
		'email',
		'sujet_id',
		'message',
		'date_envoi'
	];

	public function sujet()
	{
		return $this->belongsTo(Sujet::class);
	}
}
