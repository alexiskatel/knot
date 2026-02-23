<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Facades\Storage;

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
 * @property string|null $model_type
 * @property int|null $model_id
 * @property int|null $team_id
 * @property int $size
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Media extends Model
{
    use HasFactory;

    protected $table = 'medias';

    protected $casts = [
        'size' => 'int',
        'model_id' => 'int',
        'team_id' => 'int'
    ];

    protected $fillable = [
        'name',
        'file_name',
        'mime_type',
        'path',
        'disk',
        'file_hash',
        'collection',
        'model_type',
        'model_id',
        'team_id',
        'size'
    ];

    /**
     * Récupère le modèle polymorphique associé
     */
    public function model(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Récupère le team associé au média
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * Récupère l'URL du média
     */
    public function getUrlAttribute(): string
    {
        return Storage::disk($this->disk)->url($this->path);
    }

    /**
     * Supprime le fichier du stockage lors de la suppression du modèle
     */
    protected static function booted()
    {
        static::deleting(function ($media) {
            Storage::disk($media->disk)->delete($media->path);
        });
    }
}