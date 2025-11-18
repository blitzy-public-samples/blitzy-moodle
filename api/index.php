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
 * Main REST API router and request handler.
 *
 * This file serves as the entry point for all REST API requests from the React frontend.
 * It handles HTTP request routing, CORS headers, request method validation, and delegates
 * to versioned API endpoints in the v1/ subdirectory.
 *
 * Key responsibilities:
 * - Load Moodle configuration and initialize environment
 * - Parse URL paths to determine API version and resource
 * - Set CORS headers for cross-origin requests from React frontend
 * - Handle OPTIONS method for CORS preflight requests
 * - Validate HTTP methods and URL patterns
 * - Route requests to specific endpoint handlers in v1/ subdirectory
 * - Return 404 JSON errors for invalid routes
 * - Catch and format exceptions as JSON error responses
 * - Ensure all responses follow consistent JSON format
 *
 * URL Pattern: /api/v{version}/{resource}/{...}
 * Example: /api/v1/courses/123 → routes to v1/courses/show.php
 *
 * This router follows the thin wrapper pattern - it contains no business logic,
 * only routing and request handling. All business operations are delegated to
 * endpoint files which call existing Moodle core functions.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and initialize core environment
// This provides access to $CFG global, database connection, and all Moodle functions
require_once(__DIR__ . '/../config.php');

// Load API utility classes for response formatting and exception handling
require_once(__DIR__ . '/lib/api_response.php');
require_once(__DIR__ . '/lib/api_exception.php');

// Set Content-Type header for all API responses (JSON format)
header('Content-Type: application/json; charset=utf-8');

// Configure CORS (Cross-Origin Resource Sharing) headers for React frontend
// These headers allow the React application to make cross-origin requests to the API

// Allow origins specified in config, or restrict to configured frontend origin
if (isset($CFG->api_allowed_origins)) {
    // Support multiple origins or wildcard for development
    $allowedOrigins = is_array($CFG->api_allowed_origins) ? $CFG->api_allowed_origins : [$CFG->api_allowed_origins];
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    
    // Check if request origin is in allowed list or if wildcard is configured
    if (in_array($origin, $allowedOrigins) || in_array('*', $allowedOrigins)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    } else if (!empty($allowedOrigins[0])) {
        // Use first allowed origin as default
        header('Access-Control-Allow-Origin: ' . $allowedOrigins[0]);
    }
} else {
    // Default: allow same origin only (most secure for production)
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    header('Access-Control-Allow-Origin: ' . $protocol . '://' . $host);
}

// Allow credentials (cookies, authorization headers) to be sent with requests
// Required for JWT tokens in Authorization header or httpOnly cookies
header('Access-Control-Allow-Credentials: true');

// Specify allowed HTTP methods for API endpoints
// GET: retrieve resources, POST: create resources, PUT: update resources, DELETE: remove resources
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

// Specify allowed request headers, including Authorization for JWT tokens
// Content-Type: for JSON payloads, Authorization: for JWT bearer tokens
// X-Requested-With: for AJAX request identification
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept');

// Set max age for preflight request caching (24 hours = 86400 seconds)
// Reduces preflight requests by allowing browsers to cache CORS policy
header('Access-Control-Max-Age: 86400');

// Handle OPTIONS preflight requests
// Browsers send OPTIONS request before actual request to check CORS permissions
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Return 200 OK with CORS headers (already set above)
    http_response_code(200);
    exit;
}

// Wrap entire routing logic in try-catch for comprehensive error handling
try {
    // Parse the request URI to extract API version and resource path
    // Example: /api/v1/courses/123 → version='v1', resource='courses/123'
    
    // Get the request URI and remove query string if present
    $requestUri = $_SERVER['REQUEST_URI'];
    $uriParts = explode('?', $requestUri);
    $path = $uriParts[0];
    
    // Remove leading slash and 'api/' prefix
    $path = trim($path, '/');
    if (strpos($path, 'api/') === 0) {
        $path = substr($path, 4); // Remove 'api/' prefix
    }
    
    // Split remaining path into components
    // Expected format: v{version}/{resource}/{...}
    $pathComponents = explode('/', $path, 2);
    
    // Validate that we have at least version component
    if (empty($pathComponents[0])) {
        ApiResponse::error(
            'INVALID_REQUEST',
            'Invalid API request format. Expected format: /api/v{version}/{resource}',
            400
        );
    }
    
    // Extract API version (e.g., 'v1')
    $apiVersion = $pathComponents[0];
    
    // Extract resource path (e.g., 'courses/123' or 'auth/login')
    $resourcePath = isset($pathComponents[1]) ? $pathComponents[1] : '';
    
    // Validate API version - currently only v1 is supported
    $supportedVersions = ['v1'];
    if (!in_array($apiVersion, $supportedVersions)) {
        ApiResponse::error(
            'UNSUPPORTED_VERSION',
            'API version "' . htmlspecialchars($apiVersion) . '" is not supported. Supported versions: ' . implode(', ', $supportedVersions),
            400
        );
    }
    
    // If no resource path provided, return API information
    if (empty($resourcePath)) {
        ApiResponse::success([
            'api' => 'Moodle REST API',
            'version' => $apiVersion,
            'status' => 'operational',
            'documentation' => $CFG->wwwroot . '/api/docs',
            'supported_versions' => $supportedVersions,
        ]);
    }
    
    // Map HTTP method and resource path to endpoint file
    // This allows REST-ful routing where the same resource path can have different
    // handlers for different HTTP methods (GET, POST, PUT, DELETE)
    
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Determine endpoint file based on resource path and HTTP method
    // Default behavior: look for {resource}.php that handles all methods internally
    // Special case: some resources may have method-specific files (e.g., show.php, create.php)
    
    // Parse resource path to determine endpoint file
    $resourceParts = explode('/', $resourcePath);
    $resourceName = $resourceParts[0]; // e.g., 'courses', 'users', 'auth'
    
    // Build potential endpoint file paths
    // Priority order:
    // 1. Exact path match: v1/courses/123 → v1/courses/123.php
    // 2. Resource with method: v1/courses → v1/courses/index.php (for GET/list)
    // 3. Resource handler: v1/courses → v1/courses.php (generic handler)
    
    $endpointFile = null;
    $potentialPaths = [];
    
    // Try exact path match first (for specific endpoints like auth/login, auth/logout)
    $exactPath = __DIR__ . '/' . $apiVersion . '/' . $resourcePath . '.php';
    if (file_exists($exactPath)) {
        $endpointFile = $exactPath;
    }
    
    // Try method-based routing for collections (e.g., GET /courses → courses/index.php)
    if ($endpointFile === null) {
        $methodFileMap = [
            'GET' => 'index.php',      // List/collection endpoint
            'POST' => 'create.php',    // Create new resource
            'PUT' => 'update.php',     // Update existing resource
            'DELETE' => 'delete.php',  // Delete resource
        ];
        
        // For collection endpoints (e.g., /api/v1/courses without ID)
        if (count($resourceParts) === 1 && isset($methodFileMap[$method])) {
            $methodFile = __DIR__ . '/' . $apiVersion . '/' . $resourceName . '/' . $methodFileMap[$method];
            if (file_exists($methodFile)) {
                $endpointFile = $methodFile;
            }
        }
    }
    
    // Try specific resource handler (e.g., /api/v1/courses/123 → courses/show.php)
    // Also supports nested resources (e.g., /api/v1/data/records/123 → data/records/update.php)
    if ($endpointFile === null && count($resourceParts) >= 2) {
        // Assume last part is resource ID and look for show.php, update.php, delete.php
        $actionMap = [
            'GET' => 'show.php',
            'PUT' => 'update.php',
            'DELETE' => 'delete.php',
        ];
        
        if (isset($actionMap[$method])) {
            // Check if last part is numeric (resource ID)
            $lastPart = end($resourceParts);
            if (is_numeric($lastPart)) {
                // Use all parts except last as resource path to support nested resources
                $resourcePathParts = array_slice($resourceParts, 0, -1);
                $resourcePathStr = implode('/', $resourcePathParts);
                $actionFile = __DIR__ . '/' . $apiVersion . '/' . $resourcePathStr . '/' . $actionMap[$method];
            } else {
                // Original logic: use first part only for non-numeric second part
                $actionFile = __DIR__ . '/' . $apiVersion . '/' . $resourceName . '/' . $actionMap[$method];
            }
            
            if (file_exists($actionFile)) {
                $endpointFile = $actionFile;
            }
        }
    }
    
    // Try looking for action-specific endpoints (e.g., /courses/123/enroll → courses/enroll.php)
    if ($endpointFile === null && count($resourceParts) >= 3) {
        $action = $resourceParts[2];
        $actionFile = __DIR__ . '/' . $apiVersion . '/' . $resourceName . '/' . $action . '.php';
        if (file_exists($actionFile)) {
            $endpointFile = $actionFile;
        }
    }
    
    // If no endpoint file found, return 404
    if ($endpointFile === null) {
        ApiResponse::notFound(
            'Endpoint not found: ' . htmlspecialchars($method) . ' /api/' . 
            htmlspecialchars($apiVersion) . '/' . htmlspecialchars($resourcePath)
        );
    }
    
    // Include the endpoint file which will handle the request
    // The endpoint file is responsible for:
    // - Validating JWT token authentication
    // - Checking user permissions using require_capability()
    // - Calling existing Moodle functions for business logic
    // - Formatting and returning response using ApiResponse class
    require($endpointFile);
    
} catch (ApiException $e) {
    // Handle ApiException instances with proper HTTP status and error formatting
    // ApiException provides structured error information suitable for JSON responses
    // Use fromException() for proper exception handling
    ApiResponse::fromException($e);
    
} catch (moodle_exception $e) {
    // Handle Moodle-specific exceptions (thrown by Moodle core functions)
    // Convert to API-friendly format with appropriate HTTP status
    
    // Map common Moodle exception types to HTTP status codes
    $statusCode = 500; // Default to internal server error
    $errorCode = 'MOODLE_ERROR';
    
    // Check exception error code to determine appropriate HTTP status
    $moodleErrorCode = $e->errorcode ?? '';
    if (strpos($moodleErrorCode, 'nopermission') !== false) {
        $statusCode = 403;
        $errorCode = 'PERMISSION_DENIED';
    } else if (strpos($moodleErrorCode, 'notfound') !== false) {
        $statusCode = 404;
        $errorCode = 'NOT_FOUND';
    } else if (strpos($moodleErrorCode, 'invalidlogin') !== false) {
        $statusCode = 401;
        $errorCode = 'INVALID_CREDENTIALS';
    }
    
    ApiResponse::error(
        $errorCode,
        $e->getMessage(),
        $statusCode,
        ['moodle_error' => $moodleErrorCode]
    );
    
} catch (Exception $e) {
    // Handle any other unexpected exceptions
    // In production, hide detailed error messages for security
    // In development mode, include full error details for debugging
    
    global $CFG;
    $isDevelopment = isset($CFG->debug) && $CFG->debug === DEBUG_DEVELOPER;
    
    if ($isDevelopment) {
        // Development mode: include full error details
        ApiResponse::error(
            'INTERNAL_ERROR',
            $e->getMessage(),
            500,
            [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]
        );
    } else {
        // Production mode: generic error message for security
        ApiResponse::error(
            'INTERNAL_ERROR',
            'An internal server error occurred. Please contact support if the problem persists.',
            500
        );
    }
}
