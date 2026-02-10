<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use App\Enums\FileMimeTypes;

class GenerateApiControllers extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'api:generate-controllers {--model= : Specific model to generate controller for} {--routes= : Route file to add routes to (relative to routes/ directory)} {--no-routes : Generate only controllers without routes}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate API controllers and routes for models dynamically. Use --routes to specify a custom route file or --no-routes for controllers only.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $specificModel = $this->option('model');

        if ($specificModel) {
            $this->generateForModel($specificModel);
        } else {
            $this->generateForAllModels();
        }

        $this->info('API controllers and routes generated successfully!');
    }

    /**
     * Generate controllers and routes for all models
     */
    protected function generateForAllModels()
    {
        $models = $this->getModels();

        foreach ($models as $model) {
            $this->generateForModel($model);
        }
    }

    /**
     * Generate controller and routes for a specific model
     */
    protected function generateForModel(string $modelName)
    {
        $modelClass = "App\\Models\\{$modelName}";

        if (!class_exists($modelClass)) {
            $this->error("Model {$modelClass} does not exist.");
            return;
        }

        $this->generateController($modelName);

        if (!$this->option('no-routes')) {
            $this->addRoutes($modelName);
        }
    }

    /**
     * Get all model names from app/Models directory
     */
    protected function getModels(): array
    {
        $modelFiles = File::files(app_path('Models'));
        $models = [];

        foreach ($modelFiles as $file) {
            $filename = $file->getFilename();
            if (Str::endsWith($filename, '.php')) {
                $modelName = Str::before($filename, '.php');
                // Skip base models or system models
                if (!in_array($modelName, ['Cache', 'CacheLock', 'Job', 'JobBatch', 'Session'])) {
                    $models[] = $modelName;
                }
            }
        }

        return $models;
    }

    /**
     * Generate controller for a model
     */
    protected function generateController(string $modelName)
    {
        $controllerName = $modelName . 'Controller';
        $controllerPath = app_path("Http/Controllers/Api/{$controllerName}.php");

        if (File::exists($controllerPath)) {
            $this->warn("Controller {$controllerName} already exists. Skipping.");
            return;
        }

        $stub = $this->getControllerStub($modelName);
        File::put($controllerPath, $stub);

        $this->info("Generated controller: {$controllerName}");
    }

    /**
     * Get controller stub content
     */
    protected function getControllerStub(string $modelName): string
    {
        $modelClass = "App\\Models\\{$modelName}";
        $tableName = Str::snake(Str::plural($modelName));
        $validationRules = $this->generateValidationRules($modelName);
        $fileFields = $this->getFileFields($modelName);

        $fileFieldsArray = empty($fileFields) ? '[]' : "['" . implode("', '", $fileFields) . "']";

        return "<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\BaseApiController;
use App\Models\\{$modelName};

class {$modelName}Controller extends BaseApiController
{
    protected array \$defaultIncludes = [];
    protected array \$allowedFilters = [];
    protected array \$allowedSorts = ['id', 'created_at', 'updated_at'];
    protected array \$searchableFields = [];
    protected array \$fileFields = {$fileFieldsArray};

    /**
     * Get the model class name
     */
    protected function getModel(): string
    {
        return {$modelName}::class;
    }

    /**
     * Get validation rules
     */
    protected function getValidationRules(?int \$id = null): array
    {
{$validationRules}
    }
}
";
    }

    /**
     * Generate basic validation rules based on model fillable properties
     */
    protected function generateValidationRules(string $modelName): string
    {
        $modelClass = "App\\Models\\{$modelName}";
        $model = new $modelClass();
        $fillable = $model->getFillable();
        $tableName = $model->getTable();
        $fileFields = $this->getFileFields($modelName);

        if (empty($fillable)) {
            return "        return [
            // Add your validation rules here
        ];";
        }

        // Get nullable fields from migration
        $nullableFields = $this->getNullableFields($tableName);

        $rules = [];
        foreach ($fillable as $field) {
            $isNullable = in_array($field, $nullableFields);
            $isFile = in_array($field, $fileFields);
            $rule = $this->generateFieldRule($field, $tableName, $isNullable, $isFile);
            $rules[] = "            '{$field}' => '{$rule}'";
        }

        return "        return [\n" . implode(",\n", $rules) . "\n        ];";
    }

    /**
     * Generate validation rule for a specific field
     */
    protected function generateFieldRule(string $field, string $tableName, bool $isNullable = false, bool $isFile = false): string
    {
        if ($isFile) {
            $required = $isNullable ? 'nullable' : 'required';
            return $required . '|file|max:10240|mimes:' . FileMimeTypes::getValidationString();
        }

        $required = $isNullable ? 'nullable' : 'required';

        // Special cases for common field names
        if ($field === 'email') {
            return $required . '|email|unique:' . $tableName . ',email,{$id}';
        }

        if ($field === 'password') {
            return 'sometimes|' . $required . '|string|min:8';
        }

        if (Str::endsWith($field, '_id')) {
            $relatedTable = Str::plural(Str::before($field, '_id'));
            return $required . '|exists:' . $relatedTable . ',id';
        }

        // Default rules based on field name patterns
        if (Str::contains($field, ['name', 'title', 'label', 'description'])) {
            return $required . '|string|max:255';
        }

        if (Str::contains($field, ['price', 'amount', 'cost'])) {
            return $required . '|numeric|min:0';
        }

        if (Str::contains($field, ['quantity', 'count', 'number'])) {
            return $required . '|integer|min:0';
        }

        if (Str::contains($field, ['active', 'enabled', 'visible'])) {
            return 'boolean';
        }

        // Default fallback
        return $required . '|string|max:255';
    }

    /**
     * Get nullable fields from migration files
     */
    /**
     * Get file fields from migration files
     */
    protected function getFileFields(string $modelName): array
    {
        $tableName = Str::snake(Str::plural($modelName));
        $migrationFiles = File::files(database_path('migrations'));
        $fileFields = [];

        foreach ($migrationFiles as $file) {
            $content = File::get($file->getPathname());

            // Check if this migration creates the table we're looking for
            if (
                Str::contains($content, "Schema::create('{$tableName}'") ||
                Str::contains($content, "Schema::table('{$tableName}'")
            ) {

                // Look for fields with comment 'file'
                $lines = explode("\n", $content);
                foreach ($lines as $line) {
                    $line = trim($line);
                    if (Str::contains($line, '$table->') && Str::contains($line, '// file')) {
                        // Extract field name
                        if (preg_match('/\$table->\w+\(\'([^\']+)\'/', $line, $match)) {
                            $fileFields[] = $match[1];
                        }
                    }
                }
            }
        }

        return array_unique($fileFields);
    }

    protected function getNullableFields(string $tableName): array
    {
        $migrationFiles = File::files(database_path('migrations'));
        $nullableFields = [];

        foreach ($migrationFiles as $file) {
            $content = File::get($file->getPathname());

            // Check if this migration creates the table we're looking for
            if (
                Str::contains($content, "Schema::create('{$tableName}'") ||
                Str::contains($content, "Schema::table('{$tableName}'")
            ) {

                // Extract nullable fields using regex
                preg_match_all('/\$table->(\w+)\(\'([^\']+)\'[^;]*->nullable\(\)/', $content, $matches);

                if (!empty($matches[2])) {
                    $nullableFields = array_merge($nullableFields, $matches[2]);
                }
            }
        }

        return array_unique($nullableFields);
    }

    /**
     * Add routes for a model
     */
    protected function addRoutes(string $modelName)
    {
        $routeName = Str::snake(Str::plural($modelName));
        $controllerClass = "App\\Http\\Controllers\\Api\\{$modelName}Controller";

        $customRoutesFile = $this->option('routes');
        if ($customRoutesFile) {
            $routesFile = base_path("routes/{$customRoutesFile}.php");
            $this->ensureRouteFileExists($routesFile);
        } else {
            $routesFile = base_path('routes/api.php');
        }

        $routesContent = File::get($routesFile);

        // Check if route already exists
        if (Str::contains($routesContent, "Route::apiResource('{$routeName}'")) {
            $this->warn("Routes for {$routeName} already exist. Skipping.");
            return;
        }

        // Add the route
        if ($customRoutesFile) {
            // For custom route files, add at the end
            $routeLine = "Route::apiResource('{$routeName}', \\{$controllerClass}::class);\n";
            $routesContent .= $routeLine;
        } else {
            // For api.php, add inside the auth:sanctum group
            $routeLine = "        Route::apiResource('{$routeName}', \\{$controllerClass}::class);\n";
            // Replace the comment line with the route + comment
            $routesContent = str_replace(
                '        // require __DIR__ . \'/test.php\';',
                $routeLine . '        // require __DIR__ . \'/test.php\';',
                $routesContent
            );
        }

        File::put($routesFile, $routesContent);

        $this->info("Added routes for: {$routeName}" . ($customRoutesFile ? " to {$customRoutesFile}.php" : ""));
    }

    /**
     * Ensure the route file exists, create it if not
     */
    protected function ensureRouteFileExists(string $routesFile)
    {
        if (!File::exists($routesFile)) {
            $stub = "<?php\n\nuse Illuminate\\Support\\Facades\\Route;\n\n";
            File::put($routesFile, $stub);
            $this->info("Created route file: " . basename($routesFile));
        }
    }
}
