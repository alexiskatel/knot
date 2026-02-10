<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

class BaseApiControllerTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test GET request validation for index method
     */
    public function test_get_validation_on_index()
    {
        // Test valid request
        $response = $this->getJson('/api/v1/test-models?page=1&per_page=10&sort=name&includes=relation&search=test&all=false');

        // Should not return validation error for valid parameters
        $response->assertStatus(200);

        // Test invalid page parameter
        $response = $this->getJson('/api/v1/test-models?page=-1');
        $response->assertStatus(422); // Validation error

        // Test invalid per_page parameter (too high)
        $response = $this->getJson('/api/v1/test-models?per_page=150');
        $response->assertStatus(422); // Validation error

        // Test empty search parameter
        $response = $this->getJson('/api/v1/test-models?search=');
        $response->assertStatus(422); // Validation error
    }

    /**
     * Test GET request validation for show method
     */
    public function test_get_validation_on_show()
    {
        // Test valid request
        $response = $this->getJson('/api/v1/test-models/1?includes=relation');

        // Should not return validation error for valid parameters
        $response->assertStatus(200);

        // Test invalid includes parameter (if it should be validated differently)
        // This would depend on your specific validation rules
    }

    /**
     * Test custom GET validation rules (required parameters)
     */
    public function test_custom_get_validation_rules()
    {
        // Test request with required parameter missing
        $response = $this->getJson('/api/v1/communes?page=1&per_page=10');
        $response->assertStatus(422) // Validation error for missing departement_id
                ->assertJsonStructure([
                    'success',
                    'message',
                    'errors',
                    'timestamp'
                ])
                ->assertJson([
                    'success' => false,
                    'message' => 'Le paramètre departement_id est obligatoire pour filtrer les communes.'
                ]);

        // Test request with invalid required parameter
        $response = $this->getJson('/api/v1/communes?departement_id=invalid&page=1');
        $response->assertStatus(422) // Validation error for invalid departement_id
                ->assertJson([
                    'success' => false
                ]);

        // Test that validation errors return JSON, not redirects
        $response = $this->getJson('/api/v1/communes?page=-1');
        $response->assertStatus(422)
                ->assertJsonStructure([
                    'success',
                    'message',
                    'errors',
                    'timestamp'
                ])
                ->assertJson([
                    'success' => false,
                    'message' => 'Le numéro de page doit être supérieur à 0.'
                ]);
    }

    /**
     * Test that validation errors return JSON responses instead of redirects
     */
    public function test_validation_errors_return_json_not_redirects()
    {
        // Test POST validation error
        $response = $this->postJson('/api/v1/communes', [
            'nom_commune' => '', // Required field empty
            'code_postal' => '12345',
            'departement_id' => 1
        ]);

        $response->assertStatus(422)
                ->assertJsonStructure([
                    'success',
                    'message',
                    'errors',
                    'timestamp'
                ])
                ->assertJson([
                    'success' => false
                ]);

        // Test PUT validation error
        $response = $this->putJson('/api/v1/communes/1', [
            'nom_commune' => '', // Required field empty
            'code_postal' => '12345',
            'departement_id' => 1
        ]);

        $response->assertStatus(422)
                ->assertJsonStructure([
                    'success',
                    'message',
                    'errors',
                    'timestamp'
                ])
                ->assertJson([
                    'success' => false
                ]);
    }
}
