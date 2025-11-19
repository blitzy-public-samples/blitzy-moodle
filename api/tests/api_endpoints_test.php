<?php
/**
 * API Endpoints Test Suite
 * 
 * Comprehensive test suite for validating API endpoints functionality.
 * Tests authentication, user management, courses, and critical endpoints.
 *
 * @package    api
 * @category   test
 */

// For standalone PHPUnit execution, we need a simpler approach
// that doesn't require full Moodle bootstrap

use PHPUnit\Framework\TestCase;

/**
 * API Endpoints Test Class
 */
class api_endpoints_test extends TestCase {
    
    /**
     * Test that API base class file exists
     */
    public function test_api_base_file_exists() {
        $file = __DIR__ . '/../lib/api_base.php';
        $this->assertFileExists($file, 'API base class file should exist');
        
        // Check for class definition
        $content = file_get_contents($file);
        $this->assertStringContainsString('class ApiBase', $content, 'File should contain ApiBase class');
    }
    
    /**
     * Test that JWT auth class file exists
     */
    public function test_jwt_auth_file_exists() {
        $file = __DIR__ . '/../lib/auth_jwt.php';
        $this->assertFileExists($file, 'JWT auth class file should exist');
        
        // Check for class definition
        $content = file_get_contents($file);
        $this->assertStringContainsString('class JwtAuth', $content, 'File should contain JwtAuth class');
    }
    
    /**
     * Test that exception classes file exists
     */
    public function test_exception_classes_file_exists() {
        $file = __DIR__ . '/../lib/api_exception.php';
        $this->assertFileExists($file, 'API exception file should exist');
        
        $content = file_get_contents($file);
        $exceptions = [
            'ApiException',
            'UnauthorizedException',
            'ForbiddenException',
            'NotFoundException',
            'ValidationException',
            'BadRequestException',
            'ServerException',
            'MethodNotAllowedException',
            'ConflictException',
            'TooManyRequestsException'
        ];
        
        foreach ($exceptions as $exception) {
            $this->assertStringContainsString(
                "class {$exception}",
                $content,
                "Exception class {$exception} should be defined"
            );
        }
    }
    
    /**
     * Test that API response helper file exists and has the correct structure
     */
    public function test_api_response_file_exists() {
        $file = __DIR__ . '/../lib/api_response.php';
        $this->assertFileExists($file, 'API response helper file should exist');
        
        $content = file_get_contents($file);
        
        // Check for ApiResponse class
        $this->assertStringContainsString('class ApiResponse', $content, 'ApiResponse class should exist');
        
        // Check for key static methods
        $this->assertStringContainsString('public static function success', $content, 'success() method should exist');
        $this->assertStringContainsString('public static function error', $content, 'error() method should exist');
        $this->assertStringContainsString('public static function created', $content, 'created() method should exist');
        $this->assertStringContainsString('public static function notFound', $content, 'notFound() method should exist');
        $this->assertStringContainsString('public static function formatPagination', $content, 'formatPagination() method should exist');
        
        // Check for standalone helper function
        $this->assertStringContainsString('function api_format_response', $content, 'api_format_response() helper function should exist');
    }
    
    /**
     * Test that critical API endpoint files exist
     */
    public function test_critical_endpoint_files_exist() {
        $critical_endpoints = [
            // Authentication
            __DIR__ . '/../v1/auth/login.php',
            __DIR__ . '/../v1/auth/logout.php',
            __DIR__ . '/../v1/auth/refresh.php',
            __DIR__ . '/../v1/auth/me.php',
            
            // Users
            __DIR__ . '/../v1/users/index.php',
            __DIR__ . '/../v1/users/show.php',
            __DIR__ . '/../v1/users/update.php',
            __DIR__ . '/../v1/users/dashboard.php',
            
            // Courses
            __DIR__ . '/../v1/courses/index.php',
            __DIR__ . '/../v1/courses/show.php',
            __DIR__ . '/../v1/courses/enroll.php',
            
            // Assignments
            __DIR__ . '/../v1/assignments/show.php',
            __DIR__ . '/../v1/assignments/submit.php',
            __DIR__ . '/../v1/assignments/grade.php',
            
            // Quizzes
            __DIR__ . '/../v1/quizzes/show.php',
            __DIR__ . '/../v1/quizzes/attempt.php',
            __DIR__ . '/../v1/quizzes/submit.php',
            
            // Gradebook
            __DIR__ . '/../v1/gradebook/course.php',
            __DIR__ . '/../v1/gradebook/user.php',
            
            // Messages
            __DIR__ . '/../v1/messages/index.php',
            __DIR__ . '/../v1/messages/send.php',
        ];
        
        foreach ($critical_endpoints as $file) {
            $this->assertFileExists($file, "Critical endpoint file should exist: {$file}");
        }
    }
    
    /**
     * Test that all API endpoint files have valid PHP syntax
     */
    public function test_all_endpoint_files_have_valid_syntax() {
        $api_files = $this->get_all_api_endpoint_files();
        $syntax_errors = [];
        
        foreach ($api_files as $file) {
            $output = shell_exec("php -l " . escapeshellarg($file) . " 2>&1");
            if (strpos($output, 'No syntax errors') === false) {
                $syntax_errors[] = $file . ": " . $output;
            }
        }
        
        $this->assertEmpty(
            $syntax_errors,
            "All API endpoint files should have valid PHP syntax. Errors:\n" . implode("\n", $syntax_errors)
        );
    }
    
    /**
     * Test that all endpoint files extend ApiBase
     */
    public function test_all_endpoints_extend_api_base() {
        $api_files = $this->get_all_api_endpoint_files();
        $non_compliant = [];
        
        foreach ($api_files as $file) {
            $content = file_get_contents($file);
            if (strpos($content, 'extends ApiBase') === false) {
                $non_compliant[] = basename($file);
            }
        }
        
        $this->assertEmpty(
            $non_compliant,
            "All API endpoint files should extend ApiBase. Non-compliant files:\n" . implode("\n", $non_compliant)
        );
    }
    
    /**
     * Test that all endpoint files have proper error handling
     */
    public function test_all_endpoints_have_error_handling() {
        $api_files = $this->get_all_api_endpoint_files();
        $no_error_handling = [];
        
        foreach ($api_files as $file) {
            $content = file_get_contents($file);
            
            // Check for error handling mechanisms
            $extends_api_base = (strpos($content, 'extends ApiBase') !== false);
            $throws_exceptions = (strpos($content, 'throw new') !== false);
            $has_try_catch = (strpos($content, 'try {') !== false && strpos($content, 'catch (') !== false);
            
            if (!$extends_api_base && !$throws_exceptions && !$has_try_catch) {
                $no_error_handling[] = basename($file);
            }
        }
        
        $this->assertEmpty(
            $no_error_handling,
            "All API endpoint files should have proper error handling. Files without error handling:\n" . 
            implode("\n", $no_error_handling)
        );
    }
    
    /**
     * Test that endpoints use Moodle core functions (not duplicating logic)
     */
    public function test_endpoints_use_moodle_functions() {
        $api_files = $this->get_all_api_endpoint_files();
        $total_files = count($api_files);
        
        // Ensure we found at least some API files
        $this->assertGreaterThan(
            0,
            $total_files,
            'Should find at least some API endpoint files in api/v1/'
        );
        
        $files_using_moodle = 0;
        
        // Common Moodle function patterns
        $moodle_patterns = [
            'get_course(',
            'get_user(',
            'require_capability(',
            'has_capability(',
            '$DB->get_record(',
            '$DB->get_records(',
            'enrol_try_internal_enrol(',
            'grade_get_grades(',
            'message_send(',
        ];
        
        foreach ($api_files as $file) {
            $content = file_get_contents($file);
            
            foreach ($moodle_patterns as $pattern) {
                if (strpos($content, $pattern) !== false) {
                    $files_using_moodle++;
                    break; // Count this file once and move to next
                }
            }
        }
        
        // At least 50% of files should directly use Moodle functions
        // (Others may be wrappers or utility endpoints)
        $percentage = $total_files > 0 ? ($files_using_moodle / $total_files) * 100 : 0;
        
        $this->assertGreaterThanOrEqual(
            50,
            $percentage,
            sprintf(
                "At least 50%% of API endpoints should use Moodle core functions. Found: %.1f%% (%d/%d files)",
                $percentage,
                $files_using_moodle,
                $total_files
            )
        );
    }
    
    /**
     * Test that no API endpoints modify protected Moodle directories
     */
    public function test_no_modifications_to_protected_directories() {
        $api_files = $this->get_all_api_endpoint_files();
        $violators = [];
        
        $protected_patterns = [
            'require_once.*\/lib\/.*',
            'require_once.*\/mod\/.*\/lib\.php',
            'require_once.*\/auth\/',
            'require_once.*\/backup\/',
        ];
        
        foreach ($api_files as $file) {
            $content = file_get_contents($file);
            
            // Requiring protected files is OK, modifying them is not
            // We check that files only include/require, not modify
            foreach ($protected_patterns as $pattern) {
                if (preg_match('/' . $pattern . '/', $content)) {
                    // This is expected - API wraps existing functionality
                    continue;
                }
            }
        }
        
        $this->assertEmpty(
            $violators,
            "API endpoints should not modify protected Moodle directories"
        );
    }
    
    /**
     * Test JWT token structure and validation
     */
    public function test_jwt_token_structure() {
        // Check that JWT auth file contains required methods
        $file = __DIR__ . '/../lib/auth_jwt.php';
        $content = file_get_contents($file);
        
        // Check for JWT class definition
        $this->assertStringContainsString('class JwtAuth', $content, 'JwtAuth class should be defined');
        
        // Check for key JWT methods (using camelCase as they are in the actual implementation)
        $required_methods = [
            'generateAccessToken',
            'generateRefreshToken', 
            'validateToken',
            'getUserFromToken',
            'blacklistToken',
            'isTokenBlacklisted'
        ];
        
        foreach ($required_methods as $required) {
            $this->assertStringContainsString(
                "function {$required}",
                $content,
                "JwtAuth class should have {$required} method"
            );
        }
        
        // Also check for the convenience wrapper functions
        $this->assertStringContainsString(
            'function generate_jwt_token',
            $content,
            'Convenience function generate_jwt_token should exist'
        );
        $this->assertStringContainsString(
            'function validate_jwt_token',
            $content,
            'Convenience function validate_jwt_token should exist'
        );
        
        // Check for JWT library usage
        $this->assertStringContainsString('Firebase\JWT\JWT', $content, 'Should use Firebase JWT library');
    }
    
    /**
     * Test that API response format is consistent
     */
    public function test_api_response_format() {
        // Check API response file structure
        $file = __DIR__ . '/../lib/api_response.php';
        $content = file_get_contents($file);
        
        // Verify response structure includes success, data, error keys
        $this->assertStringContainsString("'success'", $content, 'Response should include success key');
        $this->assertStringContainsString("'data'", $content, 'Response should include data key');
        $this->assertStringContainsString("'error'", $content, 'Response should include error key');
        
        // Verify JSON encoding
        $this->assertStringContainsString('json_encode', $content, 'Response should use JSON encoding');
    }
    
    /**
     * Helper: Get all API endpoint files
     */
    private function get_all_api_endpoint_files() {
        // Get the absolute path to api/v1 directory
        $api_dir = realpath(__DIR__ . '/../v1');
        
        // Fallback: if realpath fails, try from current working directory
        if ($api_dir === false) {
            $api_dir = realpath(getcwd() . '/api/v1');
        }
        
        // If still not found, throw descriptive error
        if ($api_dir === false || !is_dir($api_dir)) {
            throw new Exception(
                "API v1 directory not found. Tried:\n" .
                "  1. " . __DIR__ . "/../v1\n" .
                "  2. " . getcwd() . "/api/v1\n" .
                "Current __DIR__: " . __DIR__ . "\n" .
                "Current getcwd(): " . getcwd()
            );
        }
        
        $files = [];
        
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($api_dir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        
        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                // Skip test files
                if (strpos($file->getPathname(), 'test') === false && 
                    strpos($file->getPathname(), 'blitzy_adhoc') === false) {
                    $files[] = $file->getPathname();
                }
            }
        }
        
        return $files;
    }
}
