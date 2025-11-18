<?php
/**
 * Ad-hoc unit tests for API infrastructure (api_base, api_response, api_exception, auth_jwt)
 * 
 * This file tests the core API framework components that all endpoints depend on.
 * 
 * @package    api
 * @copyright  2024 Moodle React Refactoring
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

global $CFG;
// API is at repository root, not under $CFG->dirroot (which is /public)
$api_root = dirname($CFG->dirroot) . '/api';
require_once($api_root . '/lib/api_exception.php');
require_once($api_root . '/lib/api_response.php');
require_once($api_root . '/lib/auth_jwt.php');

/**
 * Test API infrastructure components
 */
class blitzy_adhoc_test_api_infrastructure extends advanced_testcase {

    /**
     * Test ApiException creation and structure
     */
    public function test_api_exception_creation() {
        $this->resetAfterTest(true);

        $exception = new ApiException('Test error message', 'TEST_ERROR_CODE', 400);
        
        $this->assertEquals('Test error message', $exception->getMessage());
        $this->assertEquals('TEST_ERROR_CODE', $exception->getErrorCode());
        $this->assertEquals(400, $exception->getHttpStatus());
        $this->assertIsArray($exception->getDetails());
    }

    /**
     * Test ApiException with details
     */
    public function test_api_exception_with_details() {
        $this->resetAfterTest(true);

        $details = ['field' => 'username', 'constraint' => 'required'];
        $exception = new ApiException('Validation failed', 'VALIDATION_ERROR', 422, $details);
        
        $this->assertEquals($details, $exception->getDetails());
    }

    /**
     * Test success response formatting
     */
    public function test_api_response_success() {
        $this->resetAfterTest(true);

        $data = ['id' => 123, 'name' => 'Test Course'];
        $response = api_format_response(true, $data);

        $this->assertTrue($response['success']);
        $this->assertEquals($data, $response['data']);
        $this->assertArrayNotHasKey('error', $response);
    }

    /**
     * Test success response with metadata
     */
    public function test_api_response_with_metadata() {
        $this->resetAfterTest(true);

        $data = ['items' => [1, 2, 3]];
        $meta = ['pagination' => ['page' => 1, 'total' => 100]];
        $response = api_format_response(true, $data, 200, $meta);

        $this->assertTrue($response['success']);
        $this->assertEquals($data, $response['data']);
        $this->assertEquals($meta, $response['meta']);
    }

    /**
     * Test error response formatting
     */
    public function test_api_response_error() {
        $this->resetAfterTest(true);

        $error = [
            'code' => 'NOT_FOUND',
            'message' => 'Resource not found'
        ];
        $response = api_format_response(false, null, 404, null, $error);

        $this->assertFalse($response['success']);
        $this->assertEquals($error, $response['error']);
        $this->assertArrayNotHasKey('data', $response);
    }

    /**
     * Test JWT token generation
     */
    public function test_jwt_token_generation() {
        global $CFG;
        $this->resetAfterTest(true);

        // Set a test JWT secret
        $CFG->jwt_secret = 'test_secret_key_for_testing_purposes_only_min_256_bits_required_hs256';
        $CFG->wwwroot = 'http://example.com';

        $userid = 123;
        $roles = ['student', 'teacher'];

        $token = generate_jwt_token($userid, $roles);

        $this->assertIsString($token);
        $this->assertNotEmpty($token);
        // JWT tokens have 3 parts separated by dots
        $parts = explode('.', $token);
        $this->assertCount(3, $parts);
    }

    /**
     * Test JWT token validation
     */
    public function test_jwt_token_validation() {
        global $CFG;
        $this->resetAfterTest(true);

        // Set a test JWT secret
        $CFG->jwt_secret = 'test_secret_key_for_testing_purposes_only_min_256_bits_required_hs256';
        $CFG->wwwroot = 'http://example.com';

        $userid = 456;
        $roles = ['teacher'];

        $token = generate_jwt_token($userid, $roles);
        $decoded = validate_jwt_token($token);

        $this->assertIsObject($decoded);
        $this->assertEquals($userid, $decoded->sub);
        $this->assertEquals($roles, $decoded->roles);
        $this->assertEquals($CFG->wwwroot, $decoded->iss);
    }

    /**
     * Test JWT token expiration
     */
    public function test_jwt_token_expiration() {
        global $CFG;
        $this->resetAfterTest(true);

        $CFG->jwt_secret = 'test_secret_key_for_testing_purposes_only_min_256_bits_required_hs256';
        $CFG->wwwroot = 'http://example.com';

        $token = generate_jwt_token(789, ['student'], -3600); // Expired 1 hour ago

        $this->expectException(ApiException::class);
        $this->expectExceptionMessage('Expired token');
        validate_jwt_token($token);
    }

    /**
     * Test invalid JWT token
     */
    public function test_jwt_invalid_token() {
        global $CFG;
        $this->resetAfterTest(true);

        $CFG->jwt_secret = 'test_secret_key_for_testing_purposes_only_min_256_bits_required_hs256';

        $this->expectException(ApiException::class);
        validate_jwt_token('invalid.token.string');
    }
}
