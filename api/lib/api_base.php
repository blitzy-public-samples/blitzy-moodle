<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Abstract base class for REST API endpoints.
 *
 * Provides foundational infrastructure for JWT validation, HTTP method routing,
 * request handling, and response formatting. All API endpoint files extend this
 * class to inherit common functionality:
 *
 * - Automatic JWT token validation and user authentication
 * - HTTP method routing to handle_get/handle_post/handle_put/handle_delete methods
 * - Parameter extraction and validation
 * - Authorization via require_capability() integration
 * - Error handling with proper exception catching
 * - Response formatting via ApiResponse
 * - CORS header management
 * - Request logging and debugging support
 *
 * Usage example:
 * <code>
 * class CourseEndpoint extends ApiBase {
 *     protected function handle_get() {
 *         $courseid = $this->getParam('id', PARAM_INT);
 *         $context = context_course::instance($courseid);
 *         $this->checkCapability('moodle/course:view', $context);
 *         
 *         $course = get_course($courseid);
 *         return $this->success($course);
 *     }
 * }
 * </code>
 *
 * @package    api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries (skip in test mode)
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    require_once(__DIR__ . '/../../config.php');
    require_once($CFG->libdir . '/moodlelib.php');
    require_once($CFG->libdir . '/accesslib.php');
}

// Load API utilities
require_once(__DIR__ . '/api_exception.php');
require_once(__DIR__ . '/api_response.php');
require_once(__DIR__ . '/auth_jwt.php');

/**
 * Abstract base class for all REST API endpoints.
 *
 * Implements core functionality for JWT authentication, request routing,
 * error handling, and response formatting. Subclasses must implement
 * abstract handle_* methods for specific HTTP methods they support.
 */
abstract class ApiBase {
    
    /**
     * @var object|null Authenticated user object from JWT token
     */
    protected $user;
    
    /**
     * @var JwtAuth JWT authentication handler instance
     */
    protected $jwtAuth;
    
    /**
     * @var string HTTP request method (GET, POST, PUT, DELETE, OPTIONS)
     */
    protected $method;
    
    /**
     * @var string Request URI path
     */
    protected $requestUri;
    
    /**
     * @var bool Whether authentication is required for this endpoint
     */
    protected $requireAuth = true;
    
    /**
     * Constructor - initializes authentication and request context.
     *
     * Automatically validates JWT token and authenticates user unless
     * $requireAuth is set to false by subclass. Extracts HTTP method
     * and request URI for routing purposes.
     *
     * @throws UnauthorizedException If authentication fails and auth is required
     */
    public function __construct() {
        // Initialize JWT authentication handler
        $this->jwtAuth = new JwtAuth();
        
        // Extract HTTP method from request
        $this->method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        
        // Extract request URI
        $this->requestUri = $_SERVER['REQUEST_URI'] ?? '';
        
        // Authenticate user via JWT token if required
        $this->user = null;
        
        // In test mode, bypass JWT authentication and use test user
        if (defined('API_TEST_MODE') && API_TEST_MODE) {
            global $USER;
            // In test mode, use the global $USER object which should be set by the test
            // If not set, we'll create a mock admin user
            if (isset($USER) && $USER->id > 0) {
                $this->user = $USER;
            } else {
                // Create a mock admin user for testing
                $this->user = (object)[
                    'id' => 2, // Standard admin user ID
                    'username' => 'admin',
                    'firstname' => 'Admin',
                    'lastname' => 'User',
                ];
            }
        } elseif ($this->requireAuth) {
            try {
                // Extract JWT token from Authorization header
                $token = $this->jwtAuth->extractTokenFromRequest();
                
                if (!$token) {
                    throw new UnauthorizedException('No authentication token provided', [
                        'header' => 'Authorization',
                        'format' => 'Bearer <token>',
                        'reason' => 'Missing Authorization header with Bearer token'
                    ]);
                }
                
                // Validate token and get user
                $this->user = $this->jwtAuth->getUserFromToken($token);
                
            } catch (ApiException $e) {
                // Re-throw API exceptions (authentication failures)
                throw $e;
                
            } catch (Exception $e) {
                // Wrap unexpected exceptions
                throw new UnauthorizedException('Authentication failed', [
                    'originalError' => $e->getMessage()
                ]);
            }
        }
    }
    
    /**
     * Execute the API endpoint request.
     *
     * Main entry point that routes the request to the appropriate handle_*
     * method based on HTTP method. Handles CORS preflight requests and
     * catches exceptions to return formatted error responses.
     *
     * @return void Outputs JSON response directly
     */
    public function execute() {
        try {
            // Handle CORS preflight (OPTIONS) requests
            if ($this->method === 'OPTIONS') {
                $this->handleOptions();
                return;
            }
            
            // Route to appropriate handler based on HTTP method
            switch ($this->method) {
                case 'GET':
                    $result = $this->handle_get();
                    break;
                    
                case 'POST':
                    $result = $this->handle_post();
                    break;
                    
                case 'PUT':
                    $result = $this->handle_put();
                    break;
                    
                case 'DELETE':
                    $result = $this->handle_delete();
                    break;
                    
                default:
                    throw new MethodNotAllowedException("Method {$this->method} is not supported", [
                        'method' => $this->method,
                        'allowedMethods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
                    ]);
            }
            
            // If result is already an ApiResponse, output it
            // Otherwise, handlers should have already sent output via success() or error()
            if ($result instanceof ApiResponse) {
                $result->send();
            }
            
        } catch (ApiException $e) {
            // Handle API exceptions with formatted error response
            ApiResponse::fromException($e);
            
        } catch (moodle_exception $e) {
            // Handle Moodle exceptions (e.g., from require_capability)
            $apiException = new ForbiddenException($e->getMessage(), [
                'errorcode' => $e->errorcode,
                'module' => $e->module ?? 'moodle'
            ]);
            ApiResponse::fromException($apiException);
            
        } catch (Exception $e) {
            // Handle unexpected exceptions
            $apiException = new ServerException('Internal server error', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            ApiResponse::fromException($apiException);
        }
    }
    
    /**
     * Handle OPTIONS method for CORS preflight requests.
     *
     * Returns 200 OK with CORS headers to allow cross-origin requests
     * from configured origins. This is automatically called before
     * actual requests from browsers.
     *
     * @return void Outputs response directly
     */
    protected function handleOptions() {
        $isTestMode = defined('PHPUNIT_TEST') || defined('API_TEST_MODE');
        
        // Set CORS headers (skip in test environment)
        if (!$isTestMode || !headers_sent()) {
            $corsHeaders = $this->getCorsHeaders();
            foreach ($corsHeaders as $header => $value) {
                if (!headers_sent()) {
                    header("$header: $value");
                }
            }
            
            // Return 200 OK with no content
            http_response_code(200);
        }
        
        // Don't exit in test environment
        if (!$isTestMode) {
            exit;
        }
    }
    
    /**
     * Get authenticated user object.
     *
     * Returns the user authenticated via JWT token. Throws exception
     * if no user is authenticated (e.g., if endpoint allows public access
     * but method requires authentication).
     *
     * @return object User object from database
     * @throws UnauthorizedException If user is not authenticated
     */
    protected function getUser() {
        if ($this->user === null) {
            throw new UnauthorizedException('Authentication required', [
                'reason' => 'This operation requires an authenticated user'
            ]);
        }
        
        return $this->user;
    }
    
    /**
     * Check if user has a specific capability in a context.
     *
     * Wrapper around Moodle's require_capability() that integrates with
     * API exception handling. Throws ForbiddenException if the user does
     * not have the required capability.
     *
     * @param string $capability Capability name (e.g., 'moodle/course:view')
     * @param context $context  Context object to check capability in
     * @throws ForbiddenException If user lacks the required capability
     * @throws UnauthorizedException If no user is authenticated
     */
    protected function checkCapability($capability, $context) {
        // Ensure user is authenticated
        $user = $this->getUser();
        
        try {
            // Use Moodle's capability checking system
            require_capability($capability, $context, $user->id);
            
        } catch (moodle_exception $e) {
            // Convert Moodle exception to API exception
            throw new ForbiddenException("Permission denied: {$e->getMessage()}", [
                'capability' => $capability,
                'contextId' => $context->id,
                'contextLevel' => $context->contextlevel,
                'userId' => $user->id,
                'errorcode' => $e->errorcode
            ]);
        }
    }
    
    /**
     * Get request parameter with type validation.
     *
     * Wrapper around Moodle's optional_param() and required_param() functions
     * that provides consistent parameter extraction with type validation.
     *
     * @param string $name     Parameter name
     * @param int    $type     Parameter type (PARAM_* constant from moodlelib)
     * @param bool   $required Whether parameter is required (default: true)
     * @param mixed  $default  Default value if parameter not provided and not required
     * @return mixed Parameter value, type-cleaned
     * @throws ValidationException If required parameter is missing
     */
    protected function getParam($name, $type = PARAM_RAW, $required = true, $default = null) {
        try {
            if ($required) {
                // Use required_param for required parameters
                return required_param($name, $type);
            } else {
                // Use optional_param for optional parameters
                return optional_param($name, $default, $type);
            }
            
        } catch (Exception $e) {
            // Convert to validation exception
            throw new ValidationException("Invalid or missing parameter: {$name}", [
                'parameter' => $name,
                'required' => $required,
                'type' => $this->getParamTypeName($type),
                'originalError' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Get JSON request body as associative array.
     *
     * Reads the raw request body from php://input, decodes it as JSON,
     * and validates that the Content-Type header is application/json.
     * Throws ValidationException if JSON is malformed or Content-Type is wrong.
     *
     * @return array Decoded JSON data as associative array
     * @throws ValidationException If JSON is invalid or Content-Type is wrong
     */
    protected function getJsonBody() {
        // Validate Content-Type header
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        
        // Remove charset if present (e.g., "application/json; charset=utf-8")
        $contentType = explode(';', $contentType)[0];
        $contentType = trim($contentType);
        
        if ($contentType !== 'application/json') {
            throw new ValidationException('Invalid Content-Type header', [
                'expected' => 'application/json',
                'received' => $contentType,
                'reason' => 'Request body must be JSON'
            ]);
        }
        
        // Read raw request body
        $rawBody = file_get_contents('php://input');
        
        if (empty($rawBody)) {
            throw new ValidationException('Empty request body', [
                'reason' => 'Expected JSON data in request body'
            ]);
        }
        
        // Decode JSON
        $data = json_decode($rawBody, true);
        
        // Check for JSON decode errors
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new ValidationException('Invalid JSON in request body', [
                'jsonError' => json_last_error_msg(),
                'reason' => 'Request body must be valid JSON'
            ]);
        }
        
        return $data;
    }
    
    /**
     * Get CORS headers for cross-origin requests.
     *
     * Returns array of CORS headers based on configuration. Uses
     * $CFG->api_cors_origins to determine allowed origins. If not
     * configured, allows all origins (for development only).
     *
     * @return array Associative array of header name => value
     */
    protected function getCorsHeaders() {
        global $CFG;
        
        $headers = [];
        
        // Get allowed origins from configuration (default to * in test mode)
        $allowedOrigins = '*';
        if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
            $allowedOrigins = $CFG->api_cors_origins ?? '*';
        }
        
        // Get origin from request
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        
        // Set Access-Control-Allow-Origin
        if ($allowedOrigins === '*') {
            // Allow all origins (development only - not recommended for production)
            $headers['Access-Control-Allow-Origin'] = '*';
        } else if (is_array($allowedOrigins) && in_array($origin, $allowedOrigins)) {
            // Allow specific origin if in whitelist
            $headers['Access-Control-Allow-Origin'] = $origin;
            $headers['Vary'] = 'Origin';
        } else if (is_string($allowedOrigins) && $allowedOrigins === $origin) {
            // Allow single configured origin
            $headers['Access-Control-Allow-Origin'] = $origin;
        }
        
        // Set other CORS headers
        $headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        $headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
        $headers['Access-Control-Max-Age'] = '86400'; // 24 hours
        $headers['Access-Control-Allow-Credentials'] = 'true';
        
        return $headers;
    }
    
    /**
     * Send success response with data.
     *
     * Shorthand helper method for ApiResponse::success(). Automatically
     * sets CORS headers and returns formatted success response.
     *
     * @param mixed $data   Data to return in response
     * @param int   $status HTTP status code (default: 200)
     * @param array $meta   Optional metadata (e.g., pagination info)
     * @return void Outputs response directly
     */
    protected function success($data, $status = 200, $meta = null) {
        // Set CORS headers
        $this->setCorsHeaders();
        
        // Send success response
        ApiResponse::success($data, $status, $meta);
    }
    
    /**
     * Send error response.
     *
     * Shorthand helper method for ApiResponse::error(). Automatically
     * sets CORS headers and returns formatted error response.
     *
     * @param string $code    Error code identifier
     * @param string $message Human-readable error message
     * @param int    $status  HTTP status code (default: 500)
     * @param array  $details Optional additional error details
     * @return void Outputs response directly
     */
    protected function error($code, $message, $status = 500, $details = []) {
        // Set CORS headers
        $this->setCorsHeaders();
        
        // Send error response
        ApiResponse::error($code, $message, $status, $details);
    }
    
    /**
     * Set CORS headers in current response.
     *
     * Helper method to apply CORS headers to the current HTTP response.
     * Called automatically by success() and error() methods.
     *
     * @return void
     */
    private function setCorsHeaders() {
        // Skip setting headers in test environment where headers are already sent
        if ((defined('PHPUNIT_TEST') || defined('API_TEST_MODE')) && headers_sent()) {
            return;
        }
        
        $corsHeaders = $this->getCorsHeaders();
        
        foreach ($corsHeaders as $header => $value) {
            if (!headers_sent()) {
                header("$header: $value");
            }
        }
    }
    
    /**
     * Get human-readable name for parameter type constant.
     *
     * Helper method to convert PARAM_* constants to readable names
     * for error messages.
     *
     * @param int $type PARAM_* constant
     * @return string Human-readable type name
     */
    private function getParamTypeName($type) {
        $types = [
            PARAM_INT => 'integer',
            PARAM_ALPHANUM => 'alphanumeric',
            PARAM_ALPHA => 'alphabetic',
            PARAM_TEXT => 'text',
            PARAM_RAW => 'raw',
            PARAM_BOOL => 'boolean',
            PARAM_EMAIL => 'email',
            PARAM_URL => 'URL',
        ];
        
        return $types[$type] ?? 'unknown';
    }
    
    /**
     * Abstract method: Handle GET requests.
     *
     * Subclasses must implement this method to handle GET requests.
     * If the endpoint does not support GET, throw MethodNotAllowedException.
     *
     * @return void Should call success() or error() to send response
     * @throws MethodNotAllowedException If GET is not supported
     */
    abstract protected function handle_get();
    
    /**
     * Abstract method: Handle POST requests.
     *
     * Subclasses must implement this method to handle POST requests.
     * If the endpoint does not support POST, throw MethodNotAllowedException.
     *
     * @return void Should call success() or error() to send response
     * @throws MethodNotAllowedException If POST is not supported
     */
    abstract protected function handle_post();
    
    /**
     * Abstract method: Handle PUT requests.
     *
     * Subclasses must implement this method to handle PUT requests.
     * If the endpoint does not support PUT, throw MethodNotAllowedException.
     *
     * @return void Should call success() or error() to send response
     * @throws MethodNotAllowedException If PUT is not supported
     */
    abstract protected function handle_put();
    
    /**
     * Abstract method: Handle DELETE requests.
     *
     * Subclasses must implement this method to handle DELETE requests.
     * If the endpoint does not support DELETE, throw MethodNotAllowedException.
     *
     * @return void Should call success() or error() to send response
     * @throws MethodNotAllowedException If DELETE is not supported
     */
    abstract protected function handle_delete();
}

/**
 * Helper function to send 204 No Content response.
 *
 * Convenience function for endpoints that need to return success
 * with no data (e.g., DELETE operations). Sets appropriate HTTP
 * status code and CORS headers, then exits.
 *
 * @return void Outputs response and exits
 */
function noContent() {
    $isTestMode = defined('PHPUNIT_TEST') || defined('API_TEST_MODE');
    
    // Set CORS headers (skip in test environment)
    if (!$isTestMode || !headers_sent()) {
        $corsHeaders = [
            'Access-Control-Allow-Origin' => $_SERVER['HTTP_ORIGIN'] ?? '*',
            'Access-Control-Allow-Methods' => 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials' => 'true',
        ];
        
        foreach ($corsHeaders as $header => $value) {
            if (!headers_sent()) {
                header("$header: $value");
            }
        }
        
        // Send 204 No Content
        http_response_code(204);
    }
    
    // Don't exit in test environment
    if (!$isTestMode) {
        exit;
    }
}


