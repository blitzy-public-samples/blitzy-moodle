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
 * Custom exception classes for REST API error handling.
 *
 * Provides a hierarchy of exception classes for consistent error handling across
 * all API endpoints. Each exception maps to appropriate HTTP status codes and
 * provides structured error information suitable for JSON API responses.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include Moodle configuration (skip in test mode)
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    require_once(__DIR__ . '/../../config.php');
}

/**
 * Base API Exception class for all REST API errors.
 *
 * This class extends PHP's built-in Exception to provide HTTP status code mapping,
 * structured error codes, and detailed error messages suitable for JSON responses.
 * All specific API exception types inherit from this base class.
 *
 * Example usage:
 * <code>
 * throw new ApiException(500, 'INTERNAL_ERROR', 'Database connection failed', $debuginfo);
 * </code>
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class ApiException extends Exception {
    
    /**
     * @var int HTTP status code for this exception
     */
    protected $httpstatus;
    
    /**
     * @var string Machine-readable error code for client-side handling
     */
    protected $errorcode;
    
    /**
     * @var array Optional debug information for development/troubleshooting
     */
    protected $debuginfo;
    
    /**
     * Constructor for ApiException.
     *
     * @param int    $httpstatus HTTP status code (default: 500)
     * @param string $errorcode  Machine-readable error code (e.g., 'INTERNAL_ERROR')
     * @param string $message    Human-readable error message
     * @param mixed  $debuginfo  Optional debug information (array, string, or object)
     */
    public function __construct($httpstatus = 500, $errorcode = 'API_ERROR', $message = 'An error occurred', $debuginfo = null) {
        // Call parent Exception constructor with message and code
        parent::__construct($message, $httpstatus);
        
        // Store API-specific properties
        $this->httpstatus = $httpstatus;
        $this->errorcode = $errorcode;
        $this->debuginfo = $debuginfo;
    }
    
    /**
     * Get the HTTP status code for this exception.
     *
     * @return int HTTP status code (e.g., 400, 401, 403, 404, 500)
     */
    public function getHttpStatus() {
        return $this->httpstatus;
    }
    
    /**
     * Get the HTTP status code for this exception (alias for getHttpStatus).
     *
     * This method provides an alternative naming convention for compatibility
     * with code that expects getStatusCode() instead of getHttpStatus().
     *
     * @return int HTTP status code (e.g., 400, 401, 403, 404, 500)
     */
    public function getStatusCode() {
        return $this->httpstatus;
    }
    
    /**
     * Get the machine-readable error code.
     *
     * This code is intended for programmatic error handling on the client side.
     *
     * @return string Error code (e.g., 'UNAUTHORIZED', 'NOT_FOUND', 'VALIDATION_ERROR')
     */
    public function getErrorCode() {
        return $this->errorcode;
    }
    
    /**
     * Get detailed error information including all properties.
     *
     * Returns an associative array containing all error details suitable for
     * logging, debugging, or detailed error responses in development mode.
     *
     * @return array Array with keys: 'httpStatus', 'errorCode', 'message', 'debugInfo'
     */
    public function getDetails() {
        $details = [
            'httpStatus' => $this->httpstatus,
            'errorCode' => $this->errorcode,
            'message' => $this->getMessage(),
            'file' => $this->getFile(),
            'line' => $this->getLine(),
        ];
        
        // Only include debug info if it exists
        if ($this->debuginfo !== null) {
            $details['debugInfo'] = $this->debuginfo;
        }
        
        return $details;
    }
    
    /**
     * Convert exception to array format for JSON serialization.
     *
     * This method provides a standardized error response structure compatible
     * with the api_response.php error envelope format. It's designed to be
     * directly serializable to JSON for client consumption.
     *
     * In production mode, debug information is excluded for security.
     * In development mode (DEBUG_DEVELOPER), full details are included.
     *
     * @return array Array with keys: 'success', 'error' (containing code, message, details)
     */
    public function toArray() {
        global $CFG;
        
        // Build base error structure
        $error = [
            'code' => $this->errorcode,
            'message' => $this->getMessage(),
        ];
        
        // Include debug details only in development mode
        // In test mode, skip debug details as $CFG may not be available
        $isDebugMode = false;
        if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
            if (isset($CFG->debug) && defined('DEBUG_DEVELOPER') && $CFG->debug === DEBUG_DEVELOPER) {
                $isDebugMode = true;
            }
        }
        
        if ($isDebugMode) {
            $error['details'] = [
                'file' => $this->getFile(),
                'line' => $this->getLine(),
            ];
            
            if ($this->debuginfo !== null) {
                $error['details']['debugInfo'] = $this->debuginfo;
            }
        }
        
        return [
            'success' => false,
            'error' => $error,
        ];
    }
}

/**
 * Exception for authentication failures (HTTP 401 Unauthorized).
 *
 * This exception should be thrown when JWT token validation fails, tokens are
 * expired, missing, or invalid. It indicates the client must authenticate
 * (or re-authenticate) before accessing the resource.
 *
 * Example usage:
 * <code>
 * if (!$token) {
 *     throw new UnauthorizedException('Missing authentication token');
 * }
 * if ($token_expired) {
 *     throw new UnauthorizedException('Token has expired', ['expiredAt' => $expiry]);
 * }
 * </code>
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class UnauthorizedException extends ApiException {
    
    /**
     * Constructor for UnauthorizedException.
     *
     * @param string $message   Human-readable error message (default: 'Unauthorized')
     * @param mixed  $debuginfo Optional debug information
     */
    public function __construct($message = 'Unauthorized', $debuginfo = null) {
        parent::__construct(401, 'UNAUTHORIZED', $message, $debuginfo);
    }
}

/**
 * Exception for authorization failures (HTTP 403 Forbidden).
 *
 * This exception should be thrown when the user is authenticated but lacks
 * permission to access the requested resource. Typically used when
 * require_capability() checks fail or role-based access is denied.
 *
 * Example usage:
 * <code>
 * if (!has_capability('moodle/course:create', $context)) {
 *     throw new ForbiddenException('You do not have permission to create courses', [
 *         'requiredCapability' => 'moodle/course:create',
 *         'context' => 'system'
 *     ]);
 * }
 * </code>
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class ForbiddenException extends ApiException {
    
    /**
     * Constructor for ForbiddenException.
     *
     * @param string $message   Human-readable error message (default: 'Forbidden')
     * @param mixed  $debuginfo Optional debug information (e.g., required capability)
     */
    public function __construct($message = 'Forbidden', $debuginfo = null) {
        parent::__construct(403, 'FORBIDDEN', $message, $debuginfo);
    }
}

/**
 * Exception for resource not found errors (HTTP 404 Not Found).
 *
 * This exception should be thrown when a requested resource (course, user,
 * assignment, etc.) does not exist in the database or is not accessible.
 *
 * Example usage:
 * <code>
 * $course = $DB->get_record('course', ['id' => $courseid]);
 * if (!$course) {
 *     throw new NotFoundException('Course not found', [
 *         'courseId' => $courseid
 *     ]);
 * }
 * </code>
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class NotFoundException extends ApiException {
    
    /**
     * Constructor for NotFoundException.
     *
     * @param string $message   Human-readable error message (default: 'Not Found')
     * @param mixed  $debuginfo Optional debug information (e.g., resource ID)
     */
    public function __construct($message = 'Not Found', $debuginfo = null) {
        parent::__construct(404, 'NOT_FOUND', $message, $debuginfo);
    }
}

/**
 * Exception for validation errors (HTTP 400 Bad Request).
 *
 * This exception should be thrown when request parameters are invalid,
 * malformed, or fail validation rules. It indicates the client sent
 * incorrect data and should correct the request before retrying.
 *
 * Example usage:
 * <code>
 * if (empty($email) || !validate_email($email)) {
 *     throw new ValidationException('Invalid email address', [
 *         'field' => 'email',
 *         'value' => $email,
 *         'rule' => 'Must be a valid email format'
 *     ]);
 * }
 * </code>
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class ValidationException extends ApiException {
    
    /**
     * Constructor for ValidationException.
     *
     * @param string $message   Human-readable error message (default: 'Validation Failed')
     * @param mixed  $debuginfo Optional debug information (e.g., field errors, validation rules)
     */
    public function __construct($message = 'Validation Failed', $debuginfo = null) {
        parent::__construct(400, 'VALIDATION_ERROR', $message, $debuginfo);
    }
}

/**
 * Exception for bad request errors (HTTP 400 Bad Request).
 *
 * This exception should be thrown when the client sends an invalid request that
 * cannot be processed. This includes malformed JSON, invalid parameters, missing
 * required fields, or any other client-side error that doesn't fit more specific
 * exception types like ValidationException.
 *
 * Example usage:
 * <code>
 * if (!isset($request['required_field'])) {
 *     throw new BadRequestException('Missing required field: required_field');
 * }
 * if (!json_decode($body)) {
 *     throw new BadRequestException('Invalid JSON in request body');
 * }
 * </code>
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class BadRequestException extends ApiException {
    
    /**
     * Constructor for BadRequestException.
     *
     * @param string $message   Human-readable error message (default: 'Bad Request')
     * @param mixed  $debuginfo Optional debug information (e.g., invalid fields, error details)
     */
    public function __construct($message = 'Bad Request', $debuginfo = null) {
        parent::__construct(400, 'BAD_REQUEST', $message, $debuginfo);
    }
}

/**
 * Exception for server errors (HTTP 500 Internal Server Error).
 *
 * This exception should be thrown for unexpected server-side errors that are
 * not the client's fault. Examples include database connection failures,
 * unhandled exceptions, or system configuration issues.
 *
 * Example usage:
 * <code>
 * try {
 *     $result = some_critical_operation();
 * } catch (Exception $e) {
 *     throw new ServerException('Failed to complete operation', [
 *         'originalError' => $e->getMessage(),
 *         'operation' => 'some_critical_operation'
 *     ]);
 * }
 * </code>
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class ServerException extends ApiException {
    
    /**
     * Constructor for ServerException.
     *
     * @param string $message   Human-readable error message (default: 'Internal Server Error')
     * @param mixed  $debuginfo Optional debug information (e.g., stack trace, underlying error)
     */
    public function __construct($message = 'Internal Server Error', $debuginfo = null) {
        parent::__construct(500, 'INTERNAL_ERROR', $message, $debuginfo);
    }
}

/**
 * Exception for HTTP method not allowed errors (HTTP 405 Method Not Allowed).
 *
 * This exception should be thrown when a client uses an HTTP method (GET, POST,
 * PUT, DELETE) that is not supported by the endpoint. For example, attempting
 * to POST to a read-only endpoint or DELETE on a create-only endpoint.
 *
 * Example usage:
 * <code>
 * if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
 *     throw new MethodNotAllowedException('Only POST method is allowed', [
 *         'allowedMethods' => ['POST'],
 *         'requestedMethod' => $_SERVER['REQUEST_METHOD']
 *     ]);
 * }
 * </code>
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class MethodNotAllowedException extends ApiException {
    
    /**
     * Constructor for MethodNotAllowedException.
     *
     * @param string $message   Human-readable error message (default: 'Method Not Allowed')
     * @param mixed  $debuginfo Optional debug information (e.g., allowed methods)
     */
    public function __construct($message = 'Method Not Allowed', $debuginfo = null) {
        parent::__construct(405, 'METHOD_NOT_ALLOWED', $message, $debuginfo);
    }
}

