<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Storage;
use App\Models\Media;
use App\Enums\FileMimeTypes;
use Illuminate\Support\Facades\Log;

/**
 * Base API Controller with intelligent CRUD operations
 *
 * Features:
 * - Automatic filtering, sorting, pagination
 * - Standardized response format
 * - Dynamic relationship loading
 * - Smart validation
 * - Error handling
 */
abstract class BaseApiController extends Controller
{
    protected string $model;
    protected array $defaultIncludes = [];
    protected array $allowedFilters = [];
    protected array $allowedSorts = [];
    protected array $searchableFields = [];
    protected int $defaultPerPage = 15;
    protected array $validationRules = [];
    protected array $foreignSearchFields = [];
    protected array $fileFields = [];

    /**
     * Get the model class name
     */
    abstract protected function getModel(): string;

    /**
     * Get validation rules for store/update
     */
    protected function getValidationRules(?int $id = null): array
    {
        $rules = $this->validationRules;

        // Add/override file validation rules
        foreach ($this->fileFields as $field) {
            $rules[$field] = 'nullable|file|max:10240|mimes:jpeg,jpg,png,gif,pdf,doc,docx,xls,xlsx,mp4,avi,mov';
        }

        return $rules;
    }

    /**
     * Get validation rules for GET requests (query parameters)
     */
    protected function getQueryValidationRules(): array
    {
        return [
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'sort' => 'nullable|string',
            'includes' => 'nullable|string',
            'search' => 'nullable|string|min:1|max:255',
            'all' => 'nullable|boolean',
        ];
    }

    /**
     * Get additional custom GET validation rules for specific controllers
     * Override this method in child controllers to add custom required parameters
     */
    protected function getCustomQueryValidationRules(): array
    {
        return [];
    }

    /**
     * Get custom validation messages for store/update operations
     */
    protected function getValidationMessages(): array
    {
        return [];
    }

    /**
     * Get custom validation messages for GET query parameters
     */
    protected function getQueryValidationMessages(): array
    {
        return [
            'page.integer' => 'Le paramètre page doit être un entier.',
            'page.min' => 'Le paramètre page doit être au minimum 1.',
            'per_page.integer' => 'Le paramètre per_page doit être un entier.',
            'per_page.min' => 'Le paramètre per_page doit être au minimum 1.',
            'per_page.max' => 'Le paramètre per_page ne peut pas dépasser 100.',
            'sort.string' => 'Le paramètre sort doit être une chaîne de caractères.',
            'includes.string' => 'Le paramètre includes doit être une chaîne de caractères.',
            'search.string' => 'Le paramètre search doit être une chaîne de caractères.',
            'search.min' => 'Le paramètre search doit contenir au moins 1 caractère.',
            'search.max' => 'Le paramètre search ne peut pas dépasser 255 caractères.',
            'all.boolean' => 'Le paramètre all doit être un booléen.',
        ];
    }

    /**
     * Get allowed filters
     */
    protected function getAllowedFilters(): array
    {
        return $this->allowedFilters ?: $this->getModelInstance()->getFillable();
    }

    /**
     * Get allowed sorts
     */
    protected function getAllowedSorts(): array
    {
        return $this->allowedSorts ?: ['id', 'created_at', 'updated_at'];
    }

    /**
     * Get searchable fields
     */
    protected function getSearchableFields(): array
    {
        return $this->searchableFields ?: ['name', 'title'];
    }

    /**
     * Get foreign table search fields
     * Format: ['relation.field' => 'alias'] or ['relation.field']
     */
    protected function getForeignSearchFields(): array
    {
        return $this->foreignSearchFields;
    }

    /**
     * Get model instance
     */
    protected function getModelInstance(): Model
    {
        $modelClass = $this->getModel();
        return new $modelClass();
    }

    /**
     * Display a listing of the resource
     */
    public function index(Request $request)
    {
        try {
            // Validate GET query parameters
            $this->validateQueryRequest($request);

            $query = $this->buildQuery($request);
            $results = $this->paginateQuery($query, $request);

            $message = 'Enregistrements récupérés avec succès';

            // Si c'est une collection (pas paginée), ajouter le count
            if ($results instanceof Collection) {
                $data = [
                    'data' => $results,
                    'count' => $results->count(),
                    'total' => $results->count()
                ];
                return $this->successResponse($data, $message);
            }

            // Si c'est paginé, garder le format normal avec 'data'
            return $this->successResponse($results, $message);
        } catch (ValidationException $e) {
            return $this->handleValidationException($e);
        } catch (\Exception $e) {
            Log::error($e->getMessage());
            return $this->errorResponse('Une erreur inattendue s\'est produite. ' . $e->getMessage(), 500);
        }
    }


    /**
     * Display the specified resource
     */
    public function show(Request $request, int $id): JsonResponse
    {
        try {
            // Validate GET query parameters
            $this->validateQueryRequest($request);

            $model = $this->findModel($id, $request);

            return $this->successResponse($model, 'Enregistrement récupéré avec succès');
        } catch (ValidationException $e) {
            return $this->handleValidationException($e);
        } catch (\Exception $e) {
            Log::error($e->getMessage());
            return $this->errorResponse('Une erreur inattendue s\'est produite. ' . $e->getMessage(), 500);
        }
    }


    /**
     * Remove the specified resource
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $model = $this->findModel($id);

        // Delete associated media for all file fields
        foreach ($this->fileFields as $field) {
            if ($model->{$field}) {
                $media = Media::find($model->{$field});
                if ($media) {
                    $media->delete();
                }
            }
        }

        // Soft-delete : enregistrer qui a supprimé
        $apiUser = $request->attributes->get('api_user');
        if ($apiUser && in_array('deleted_by', $model->getFillable())) {
            $model->deleted_by = $apiUser->id;
            $model->saveQuietly();
        }

        $model->delete();

        return $this->successResponse(null, 'Enregistrement supprimé avec succès');
    }

    /**
     * Build the query with filters, search, includes
     */
    protected function buildQuery(Request $request): Builder
    {
        $query = $this->getModelInstance()->newQuery();

        // Apply includes
        if ($request->has('includes')) {
            $query->with($this->parseIncludes($request->includes));
        } elseif (!empty($this->defaultIncludes)) {
            $query->with($this->defaultIncludes);
        }

        // Apply filters
        $this->applyFilters($query, $request);

        // Apply search
        $this->applySearch($query, $request);

        // Apply sorting
        $this->applySorting($query, $request);

        return $query;
    }

    /**
     * Apply filters to query
     */
    protected function applyFilters(Builder $query, Request $request): void
    {
        $allowedFilters = $this->getAllowedFilters();

        foreach ($request->all() as $key => $value) {
            if (in_array($key, $allowedFilters) && !in_array($key, ['page', 'per_page', 'sort', 'includes', 'search'])) {
                $this->applyFilter($query, $key, $value);
            }
        }
    }

    /**
     * Apply single filter
     */
    protected function applyFilter(Builder $query, string $field, $value): void
    {
        if (is_array($value)) {
            $query->whereIn($field, $value);
        } elseif (str_contains($value, ',')) {
            $query->whereIn($field, explode(',', $value));
        } elseif (str_starts_with($value, 'not:')) {
            $query->where($field, '!=', substr($value, 4));
        } elseif (str_starts_with($value, 'like:')) {
            $query->where($field, 'like', '%' . substr($value, 5) . '%');
        } elseif (str_starts_with($value, 'gt:')) {
            $query->where($field, '>', substr($value, 3));
        } elseif (str_starts_with($value, 'gte:')) {
            $query->where($field, '>=', substr($value, 4));
        } elseif (str_starts_with($value, 'lt:')) {
            $query->where($field, '<', substr($value, 3));
        } elseif (str_starts_with($value, 'lte:')) {
            $query->where($field, '<=', substr($value, 4));
        } else {
            $query->where($field, $value);
        }
    }

    /**
     * Apply search to query
     */
    protected function applySearch(Builder $query, Request $request): void
    {
        if ($request->has('search') && !empty($request->search)) {
            $searchTerm = $request->search;
            $searchableFields = $this->getSearchableFields();
            $foreignSearchFields = $this->getForeignSearchFields();

            $query->where(function ($q) use ($searchTerm, $searchableFields, $foreignSearchFields) {
                // Search in local fields
                foreach ($searchableFields as $field) {
                    $q->orWhere($field, 'like', '%' . $searchTerm . '%');
                }

                // Search in foreign table fields
                foreach ($foreignSearchFields as $foreignField => $alias) {
                    if (is_numeric($foreignField)) {
                        // Format: 'relation.field'
                        $foreignField = $alias;
                        $alias = null;
                    }

                    $this->applyForeignSearch($q, $foreignField, $searchTerm, $alias);
                }
            });
        }
    }

    /**
     * Apply search on foreign table field
     */
    protected function applyForeignSearch(Builder $query, string $foreignField, string $searchTerm, ?string $alias = null): void
    {
        // Parse relation and field (e.g., 'departement.libelle')
        $parts = explode('.', $foreignField);
        if (count($parts) !== 2) {
            return; // Invalid format
        }

        [$relation, $field] = $parts;

        // Use alias if provided, otherwise use relation name
        $tableAlias = $alias ?: $relation;

        $query->orWhereHas($relation, function ($q) use ($field, $searchTerm) {
            $q->where($field, 'like', '%' . $searchTerm . '%');
        });
    }

    /**
     * Apply sorting to query
     */
    protected function applySorting(Builder $query, Request $request): void
    {
        $allowedSorts = $this->getAllowedSorts();

        if ($request->has('sort')) {
            $sortFields = explode(',', $request->sort);

            foreach ($sortFields as $sortField) {
                $direction = 'asc';
                if (str_starts_with($sortField, '-')) {
                    $direction = 'desc';
                    $sortField = substr($sortField, 1);
                }

                if (in_array($sortField, $allowedSorts)) {
                    $query->orderBy($sortField, $direction);
                }
            }
        } else {
            $query->orderBy('created_at', 'desc');
        }
    }

    /**
     * Paginate query or return all results
     */
    protected function paginateQuery(Builder $query, Request $request): LengthAwarePaginator|Collection
    {
        // Check if user wants all results without pagination
        $all = $request->get('all');
        if ($all === '1' || $all === 'true' || $all === true) {
            return $query->get();
        }

        $perPage = $request->get('per_page', $this->defaultPerPage);
        return $query->paginate($perPage);
    }

    /**
     * Parse includes parameter
     */
    protected function parseIncludes(string $includes): array
    {
        return array_map('trim', explode(',', $includes));
    }

    /**
     * Find model by ID
     */
    protected function findModel(int $id, ?Request $request = null): Model
    {
        $query = $this->getModelInstance()->newQuery();

        if ($request && $request->has('includes')) {
            $query->with($this->parseIncludes($request->includes));
        } elseif (!empty($this->defaultIncludes)) {
            $query->with($this->defaultIncludes);
        }

        $model = $query->findOrFail($id);

        return $model;
    }

    /**
     * Validate request data
     */
    protected function validateRequest(Request $request, ?int $id = null): array
    {
        $rules = $this->getValidationRules($id);
        $messages = $this->getValidationMessages();
        $validator = Validator::make($request->all(), $rules, $messages);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }

    /**
     * Validate GET request query parameters
     */
    protected function validateQueryRequest(Request $request): void
    {
        $rules = array_merge(
            $this->getQueryValidationRules(),
            $this->getCustomQueryValidationRules()
        );
        $messages = $this->getQueryValidationMessages();
        $validator = Validator::make($request->query(), $rules, $messages);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }
    }

    /**
     * Success response
     */
    protected function successResponse($data, string $message = '', int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'list' => $data,
            'timestamp' => now()->toISOString()
        ], $status);
    }

    /**
     * Error response
     */
    protected function errorResponse(string $message, int $status = 400, $errors = null): JsonResponse
    {
        $response = [
            'success' => false,
            'message' => $message,
            'timestamp' => now()->toISOString()
        ];

        if ($errors) {
            $response['errors'] = $errors;
        }

        return response()->json($response, $status);
    }

    /**
     * Handle validation exceptions and return proper JSON response
     */
    protected function handleValidationException(ValidationException $e): JsonResponse
    {
        $errors = $e->errors();
        $firstError = '';

        // Get the first error message
        foreach ($errors as $field => $fieldErrors) {
            if (!empty($fieldErrors)) {
                $firstError = $fieldErrors[0];
                break;
            }
        }

        return $this->errorResponse($firstError ?: 'Erreur de validation', 422, $errors);
    }

    /**
     * Handle pivot table operations (attach, detach, sync)
     */
    /**
     * Handle file uploads and create media records
     */
    /**
     * Handle file uploads for store (before model creation)
     */
    protected function handleFileUploadsForStore(Request $request): array
    {
        $fileIds = [];

        foreach ($this->fileFields as $field) {
            if ($request->hasFile($field)) {
                $file = $request->file($field);

                // Upload new file
                $originalName = $file->getClientOriginalName();
                $fileName = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
                $path = $file->storeAs('uploads', $fileName, 'public');

                // Create media record
                $media = Media::create([
                    'name' => $originalName,
                    'file_name' => $fileName,
                    'mime_type' => $file->getMimeType(),
                    'path' => $path,
                    'disk' => 'public',
                    'file_hash' => hash_file('md5', $file->getRealPath()),
                    'size' => $file->getSize(),
                ]);

                $fileIds[$field] = $media->id;
            }
        }

        return $fileIds;
    }

    protected function handleFileUploads(Request $request, Model $model): void
    {
        foreach ($this->fileFields as $field) {
            if ($request->hasFile($field)) {
                $file = $request->file($field);

                // Delete old media if exists
                if ($model->{$field}) {
                    $oldMedia = Media::find($model->{$field});
                    if ($oldMedia) {
                        $oldMedia->delete();
                    }
                }

                // Upload new file
                $originalName = $file->getClientOriginalName();
                $fileName = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
                $path = $file->storeAs('uploads', $fileName, 'public');

                // Create media record
                $media = Media::create([
                    'name' => $originalName,
                    'file_name' => $fileName,
                    'mime_type' => $file->getMimeType(),
                    'path' => $path,
                    'disk' => 'public',
                    'file_hash' => hash_file('md5', $file->getRealPath()),
                    'size' => $file->getSize(),
                ]);

                // Set the field on model (e.g., image_id, document_id)
                $model->{$field} = $media->id;
                $model->save();
            }
        }
    }

    protected function handlePivotOperations(Request $request, Model $model): array
    {
        $operations = [];

        // Attach relationships
        if ($request->has('attach')) {
            foreach ($request->attach as $relation => $data) {
                if (method_exists($model, $relation)) {
                    $relationInstance = $model->$relation();

                    if (is_array($data)) {
                        // Handle array of IDs or objects with pivot data
                        $ids = [];
                        $pivotData = [];

                        foreach ($data as $item) {
                            if (is_array($item) && isset($item['id'])) {
                                $ids[] = $item['id'];
                                if (isset($item['pivot'])) {
                                    $pivotData[$item['id']] = $item['pivot'];
                                }
                            } elseif (is_numeric($item)) {
                                $ids[] = $item;
                            }
                        }

                        if (!empty($pivotData)) {
                            $relationInstance->attach($pivotData);
                        } else {
                            $relationInstance->attach($ids);
                        }
                    } else {
                        $relationInstance->attach($data);
                    }

                    $operations[] = "attach_$relation";
                }
            }
        }

        // Detach relationships
        if ($request->has('detach')) {
            foreach ($request->detach as $relation => $ids) {
                if (method_exists($model, $relation)) {
                    $model->$relation()->detach($ids);
                    $operations[] = "detach_$relation";
                }
            }
        }

        // Sync relationships
        if ($request->has('sync')) {
            foreach ($request->sync as $relation => $data) {
                if (method_exists($model, $relation)) {
                    $relationInstance = $model->$relation();

                    if (is_array($data)) {
                        $ids = [];
                        $pivotData = [];

                        foreach ($data as $item) {
                            if (is_array($item) && isset($item['id'])) {
                                $ids[] = $item['id'];
                                if (isset($item['pivot'])) {
                                    $pivotData[$item['id']] = $item['pivot'];
                                }
                            } elseif (is_numeric($item)) {
                                $ids[] = $item;
                            }
                        }

                        if (!empty($pivotData)) {
                            $relationInstance->sync($pivotData);
                        } else {
                            $relationInstance->sync($ids);
                        }
                    } else {
                        $relationInstance->sync($data);
                    }

                    $operations[] = "sync_$relation";
                }
            }
        }

        return $operations;
    }

    /**
     * Update method with pivot operations support
     */
    public function update(Request $request, int $id): JsonResponse
    {
        try {
            $model = $this->findModel($id);
            $data = $this->validateRequest($request, $id);

            // Handle file uploads first (delete old, upload new)
            $this->handleFileUploads($request, $model);

            // Separate file data from model data
            $modelData = array_diff_key($data, array_flip($this->fileFields));

            $model->update($modelData);

            // Handle pivot operations
            $pivotOperations = $this->handlePivotOperations($request, $model);

            if ($request->has('includes')) {
                $model->load($this->parseIncludes($request->includes));
            }

            $message = 'Enregistrement mis à jour avec succès';
            if (!empty($pivotOperations)) {
                $message .= ' (' . implode(', ', $pivotOperations) . ')';
            }

            return $this->successResponse($model, $message);
        } catch (ValidationException $e) {
            return $this->handleValidationException($e);
        } catch (\Exception $e) {
            Log::error($e->getMessage());
            return $this->errorResponse('Une erreur inattendue s\'est produite lors de la mise à jour.', 500);
        }
    }

    /**
     * Import data from CSV or JSON file
     */
    public function import(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'file' => 'required|file|mimes:csv,txt,json|max:10240',
                'update_existing' => 'nullable|boolean'
            ]);

            $file = $request->file('file');
            $extension = $file->getClientOriginalExtension();
            $updateExisting = $request->get('update_existing', false);

            $data = [];
            if ($extension === 'csv') {
                $data = $this->parseCsv($file);
            } elseif ($extension === 'json') {
                $data = json_decode(file_get_contents($file->getRealPath()), true);
            }

            if (empty($data)) {
                return $this->errorResponse('Aucune donnée valide trouvée dans le fichier', 400);
            }

            $imported = 0;
            $errors = [];

            foreach ($data as $index => $row) {
                try {
                    $this->importRow($row, $updateExisting);
                    $imported++;
                } catch (\Exception $e) {
                    $errors[] = "Ligne " . ($index + 1) . ": " . $e->getMessage();
                }
            }

            $message = "{$imported} enregistrements importés avec succès";
            if (!empty($errors)) {
                $message .= ". Erreurs: " . implode('; ', array_slice($errors, 0, 5));
            }

            return $this->successResponse([
                'imported' => $imported,
                'errors' => $errors
            ], $message);

        } catch (ValidationException $e) {
            return $this->handleValidationException($e);
        } catch (\Exception $e) {
            Log::error($e->getMessage());
            return $this->errorResponse('Erreur lors de l\'import: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Parse CSV file
     */
    protected function parseCsv($file): array
    {
        $data = [];
        $handle = fopen($file->getRealPath(), 'r');

        $headers = fgetcsv($handle);
        while (($row = fgetcsv($handle)) !== false) {
            $data[] = array_combine($headers, $row);
        }

        fclose($handle);
        return $data;
    }

    /**
     * Import a single row
     */
    protected function importRow(array $row, bool $updateExisting = false): void
    {
        // Remove empty values
        $row = array_filter($row, function ($value) {
            return $value !== null && $value !== '';
        });

        // Check if update existing
        $modelInstance = $this->getModelInstance();
        $fillable = $modelInstance->getFillable();

        if ($updateExisting && isset($row['id'])) {
            $model = $modelInstance->find($row['id']);
            if ($model) {
                $model->update(array_intersect_key($row, array_flip($fillable)));
                return;
            }
        }

        // Create new
        $modelInstance->create(array_intersect_key($row, array_flip($fillable)));
    }

    /**
     * Store method with pivot operations support
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $data = $this->validateRequest($request);

            // Handle file uploads first to get IDs for required fields
            $fileIds = $this->handleFileUploadsForStore($request);

            // Separate file data from model data
            $modelData = array_diff_key($data, array_flip($this->fileFields));

            // Add the file IDs to model data
            $modelData = array_merge($modelData, $fileIds);

            $model = $this->getModelInstance()->create($modelData);

            // Handle pivot operations
            $pivotOperations = $this->handlePivotOperations($request, $model);

            if ($request->has('includes')) {
                $model->load($this->parseIncludes($request->includes));
            }

            $message = 'Enregistrement créé avec succès';
            if (!empty($pivotOperations)) {
                $message .= ' (' . implode(', ', $pivotOperations) . ')';
            }

            return $this->successResponse($model, $message, 201);
        } catch (ValidationException $e) {
            return $this->handleValidationException($e);
        } catch (\Exception $e) {
            Log::error($e->getMessage());
            return $this->errorResponse('Une erreur inattendue s\'est produite lors de la création.', 500);
        }
    }
}
