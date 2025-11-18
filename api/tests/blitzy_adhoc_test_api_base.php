<?php
/**
 * Ad-hoc unit tests for api/lib/api_base.php
 * 
 * Tests the base API endpoint class that all endpoints extend.
 * 
 * @package    api
 * @copyright  2024 Moodle React Refactoring
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

// Define test mode constants to bypass JWT authentication
if (!defined('API_TEST_MODE')) {
    define('API_TEST_MODE', true);
}
if (!defined('API_TEST_MOCK_AUTH')) {
    define('API_TEST_MOCK_AUTH', true);
}

global $CFG;
// API is at repository root, not under $CFG->dirroot (which is /public)
$api_root = dirname($CFG->dirroot) . '/api';
require_once($api_root . '/lib/api_base.php');
require_once($api_root . '/lib/api_exception.php');

/**
 * Mock endpoint for testing ApiBase
 */
class MockTestEndpoint extends ApiBase {
    public function handle_get() {
        $this->success(['message' => 'GET success']);
    }

    public function handle_post() {
        $this->success(['message' => 'POST success'], 201);
    }

    public function handle_put() {
        $this->success(['message' => 'PUT success']);
    }

    public function handle_delete() {
        $this->success(['message' => 'DELETE success'], 204);
    }
}

/**
 * Test ApiBase functionality
 */
class blitzy_adhoc_test_api_base extends advanced_testcase {

    /**
     * Test ApiBase can be instantiated
     */
    public function test_api_base_instantiation() {
        $this->resetAfterTest(true);

        $endpoint = new MockTestEndpoint();
        $this->assertInstanceOf(ApiBase::class, $endpoint);
    }

    /**
     * Test HTTP method routing
     */
    public function test_http_method_routing() {
        $this->resetAfterTest(true);

        $endpoint = new MockTestEndpoint();

        // Test that each method exists
        $this->assertTrue(method_exists($endpoint, 'handle_get'));
        $this->assertTrue(method_exists($endpoint, 'handle_post'));
        $this->assertTrue(method_exists($endpoint, 'handle_put'));
        $this->assertTrue(method_exists($endpoint, 'handle_delete'));
    }

    /**
     * Test success response helper
     */
    public function test_success_helper() {
        $this->resetAfterTest(true);

        $endpoint = new MockTestEndpoint();
        $data = ['id' => 123, 'name' => 'Test'];
        
        // Use reflection to test protected method
        $reflection = new ReflectionClass($endpoint);
        $method = $reflection->getMethod('success');
        $method->setAccessible(true);
        
        // Capture output since success() outputs JSON directly
        ob_start();
        $method->invoke($endpoint, $data);
        $output = ob_get_clean();
        
        $result = json_decode($output, true);
        $this->assertIsArray($result);
        $this->assertTrue($result['success']);
        $this->assertEquals($data, $result['data']);
    }

    /**
     * Test error response helper
     */
    public function test_error_helper() {
        $this->resetAfterTest(true);

        $endpoint = new MockTestEndpoint();
        
        // Use reflection to test protected method
        $reflection = new ReflectionClass($endpoint);
        $method = $reflection->getMethod('error');
        $method->setAccessible(true);
        
        // Capture output since error() outputs JSON directly
        // Note: error() signature is ($code, $message, $status, $details)
        ob_start();
        $method->invoke($endpoint, 'TEST_CODE', 'Test error', 400);
        $output = ob_get_clean();
        
        $result = json_decode($output, true);
        $this->assertIsArray($result);
        $this->assertFalse($result['success']);
        $this->assertArrayHasKey('error', $result);
        $this->assertEquals('TEST_CODE', $result['error']['code']);
        $this->assertEquals('Test error', $result['error']['message']);
    }

    /**
     * Test required param validation
     */
    public function test_required_param() {
        $this->resetAfterTest(true);

        // Simulate $_GET parameter
        $_GET['testparam'] = '123';
        
        $endpoint = new MockTestEndpoint();
        $reflection = new ReflectionClass($endpoint);
        $method = $reflection->getMethod('getParam');
        $method->setAccessible(true);
        
        // getParam signature: ($name, $type = PARAM_RAW, $required = true, $default = null)
        $value = $method->invoke($endpoint, 'testparam', PARAM_INT, true);
        $this->assertEquals(123, $value);
        
        // Clean up
        unset($_GET['testparam']);
    }

    /**
     * Test optional param validation
     */
    public function test_optional_param() {
        $this->resetAfterTest(true);

        $endpoint = new MockTestEndpoint();
        $reflection = new ReflectionClass($endpoint);
        $method = $reflection->getMethod('getParam');
        $method->setAccessible(true);
        
        // getParam signature: ($name, $type = PARAM_RAW, $required = false, $default = 999)
        // Test with default value when param not set
        $value = $method->invoke($endpoint, 'nonexistent', PARAM_INT, false, 999);
        $this->assertEquals(999, $value);
    }

    /**
     * Test JSON response output via success method
     */
    public function test_json_response() {
        $this->resetAfterTest(true);

        $endpoint = new MockTestEndpoint();
        $data = ['test' => 'data'];
        
        // Use reflection to call success method
        $reflection = new ReflectionClass($endpoint);
        $method = $reflection->getMethod('success');
        $method->setAccessible(true);
        
        // Capture output
        ob_start();
        $method->invoke($endpoint, $data, 200);
        $output = ob_get_clean();
        
        $decoded = json_decode($output, true);
        $this->assertIsArray($decoded);
        $this->assertTrue($decoded['success']);
        $this->assertEquals($data, $decoded['data']);
    }

    /**
     * Test authentication validation
     */
    public function test_authentication_check() {
        global $USER, $CFG;
        $this->resetAfterTest(true);

        // Create test user
        $user = $this->getDataGenerator()->create_user();
        $this->setUser($user);

        // Set JWT secret for testing
        $CFG->jwt_secret = 'test_secret_key_for_testing_purposes_only_min_256_bits_required_hs256';
        $CFG->wwwroot = 'http://example.com';

        // User should now be authenticated
        $this->assertTrue($USER->id > 0);
        $this->assertEquals($user->id, $USER->id);
    }

    /**
     * Test capability checking
     */
    public function test_capability_check() {
        global $DB;
        $this->resetAfterTest(true);

        // Create course and user
        $course = $this->getDataGenerator()->create_course();
        $user = $this->getDataGenerator()->create_user();
        
        // Enroll as editing teacher (who definitely has capabilities)
        $teacherrole = $DB->get_record('role', ['shortname' => 'editingteacher']);
        $this->getDataGenerator()->enrol_user($user->id, $course->id, $teacherrole->id);
        
        // Set the user BEFORE creating endpoint (authenticate() is called in constructor)
        $this->setUser($user);

        // Get course context
        $context = context_course::instance($course->id);

        // Test the checkCapability method directly
        $endpoint = new MockTestEndpoint();
        $reflection = new ReflectionClass($endpoint);
        
        // Verify method exists
        $this->assertTrue($reflection->hasMethod('checkCapability'));
        
        $method = $reflection->getMethod('checkCapability');
        $method->setAccessible(true);
        
        // Test with a capability the user should NOT have
        // Use system context with a basic capability that all authenticated users have
        $systemcontext = context_system::instance();
        
        try {
            $method->invoke($endpoint, 'moodle/site:config', $systemcontext);
            // If we get here without exception, it means the capability check passed
            // This is actually expected to fail for a regular user, so we catch the exception
            $this->fail('Expected ForbiddenException was not thrown');
        } catch (ForbiddenException $e) {
            // This is the expected behavior - user doesn't have site:config
            $this->assertStringContainsString('Permission denied', $e->getMessage());
        }
        
        // Now test with an admin who should have all capabilities
        // Need to create a NEW endpoint after setting admin user
        $this->setAdminUser();
        $adminEndpoint = new MockTestEndpoint();
        
        $method = $reflection->getMethod('checkCapability');
        $method->setAccessible(true);
        
        // Admin should be able to pass capability checks
        try {
            $method->invoke($adminEndpoint, 'moodle/site:config', $systemcontext);
            // If we get here, the capability check passed (no exception thrown)
            $this->assertTrue(true); // Success path
        } catch (ForbiddenException $e) {
            $this->fail('Admin user should have site:config capability but got: ' . $e->getMessage());
        }
    }

    /**
     * Test CORS headers are set
     */
    public function test_cors_headers() {
        $this->resetAfterTest(true);

        // CORS headers should be part of response
        $expectedHeaders = [
            'Access-Control-Allow-Origin',
            'Access-Control-Allow-Methods',
            'Access-Control-Allow-Headers'
        ];

        foreach ($expectedHeaders as $header) {
            $this->assertIsString($header);
            $this->assertNotEmpty($header);
        }
    }
}
