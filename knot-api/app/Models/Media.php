<?php

/**
 * Created by Reliese Model.
 */

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * Class Media
 * 
 * @property int $id
 * @property string $name
 * @property string $file_name
 * @property string $mime_type
 * @property string $path
 * @property string $disk
 * @property string $file_hash
 * @property string|null $collection
 * @property int $size
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * 
 * @property Collection|Banniere[] $bannieres
 * @property Collection|BonComportement[] $bon_comportements
 * @property Collection|Consequence[] $consequences
 * @property Collection|DroitVictime[] $droit_victimes
 * @property Collection|Facilitation[] $facilitations
 * @property Collection|Forme[] $formes
 * @property Collection|Institution[] $institutions
 * @property Collection|NumeroUrgence[] $numero_urgences
 * @property Collection|ObjetNumerique[] $objet_numeriques
 * @property Collection|SecuriteNumerique[] $securite_numeriques
 * @property Collection|StructurePriseEnCharge[] $structure_prise_en_charges
 *
 * @package App\Models
 */
class Media extends Model
{
	protected $table = 'medias';

	protected $casts = [
		'size' => 'int'
	];

	protected $fillable = [
		'name',
		'file_name',
		'mime_type',
		'path',
		'disk',
		'file_hash',
		'collection',
		'size'
	];

	public function bannieres()
	{
		return $this->hasMany(Banniere::class, 'image_id');
	}

	public function bon_comportements()
	{
		return $this->hasMany(BonComportement::class, 'image_id');
	}

	public function consequences()
	{
		return $this->hasMany(Consequence::class, 'image_id');
	}

	public function droit_victimes()
	{
		return $this->hasMany(DroitVictime::class, 'image_id');
	}

	public function facilitations()
	{
		return $this->hasMany(Facilitation::class, 'image_id');
	}

	public function formes()
	{
		return $this->hasMany(Forme::class, 'image_id');
	}

	public function institutions()
	{
		return $this->hasMany(Institution::class, 'image_id');
	}

	public function numero_urgences()
	{
		return $this->hasMany(NumeroUrgence::class, 'image_id');
	}

	public function objet_numeriques()
	{
		return $this->hasMany(ObjetNumerique::class, 'image_id');
	}

	public function securite_numeriques()
	{
		return $this->hasMany(SecuriteNumerique::class, 'image_id');
	}

	public function structure_prise_en_charges()
	{
		return $this->hasMany(StructurePriseEnCharge::class, 'image_id');
	}
}
