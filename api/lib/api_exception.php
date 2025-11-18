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
     * @param string $message    Human-readable error message
     * @param string $errorcode  Machine-readable error code (e.g., 'INTERNAL_ERROR')
     * @param int    $httpstatus HTTP status code (default: 500)
     * @param mixed  $debuginfo  Optional debug information (array, string, or object)
     */
    public function __construct($message = 'An error occurred', $errorcode = 'API_ERROR', $httpstatus = 500, $debuginfo = null) {
        // Call parent Exception constructor with message and code 0 (not used for HTTP APIs)
        parent::__construct($message, 0);
        
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
     * Get the custom debug/details information passed to the exception.
     *
     * Returns the debug information that was provided when the exception was
     * created. This is typically used for validation errors or other scenarios
     * where additional context about the error is needed.
     *
     * @return array Debug information array, or empty array if none provided
     */
    public function getDetails() {
        return $this->debuginfo !== null ? $this->debuginfo : [];
    }
    
    /**
     * Get comprehensive error information including all properties.
     *
     * Returns an associative array containing all error details suitable for
     * logging, debugging, or detailed error responses in development mode.
     * This includes HTTP status, error code, message, file location, and any
     * custom debug information.
     *
     * @return array Array with keys: 'httpStatus', 'errorCode', 'message', 'file', 'line', 'debugInfo'
     */
    public function getFullDetails() {
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
        parent::__construct($message, 'UNAUTHORIZED', 401, $debuginfo);
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
        parent::__construct($message, 'FORBIDDEN', 403, $debuginfo);
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
        parent::__construct($message, 'NOT_FOUND', 404, $debuginfo);
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
        parent::__construct($message, 'VALIDATION_ERROR', 400, $debuginfo);
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
        parent::__construct($message, 'BAD_REQUEST', 400, $debuginfo);
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
        parent::__construct($message, 'INTERNAL_ERROR', 500, $debuginfo);
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
        parent::__construct($message, 'METHOD_NOT_ALLOWED', 405, $debuginfo);
    }
}

/**
 * Exception for resource conflict errors (HTTP 409 Conflict).
 *
 * This exception should be thrown when a request conflicts with the current state
 * of the resource. Common scenarios include duplicate key violations, version
 * conflicts, or attempting to create a resource that already exists.
 *
 * Example usage:
 * <code>
 * if ($DB->record_exists('user', ['username' => $username])) {
 *     throw new ConflictException('Username already exists', [
 *         'field' => 'username',
 *         'value' => $username
 *     ]);
 * }
 * if ($course->version !== $expectedVersion) {
 *     throw new ConflictException('Resource has been modified by another user', [
 *         'expectedVersion' => $expectedVersion,
 *         'currentVersion' => $course->version
 *     ]);
 * }
 * </code>
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class ConflictException extends ApiException {
    
    /**
     * Constructor for ConflictException.
     *
     * @param string $message   Human-readable error message (default: 'Conflict')
     * @param mixed  $debuginfo Optional debug information (e.g., conflicting field, current state)
     */
    public function __construct($message = 'Conflict', $debuginfo = null) {
        parent::__construct($message, 'CONFLICT', 409, $debuginfo);
    }
}

/**
 * Exception for rate limiting errors (HTTP 429 Too Many Requests).
 *
 * This exception should be thrown when a client exceeds the allowed rate limit
 * for API requests. It indicates the client should wait before making additional
 * requests and should include retry-after information when possible.
 *
 * Example usage:
 * <code>
 * if ($requestCount > $rateLimit) {
 *     throw new TooManyRequestsException('Rate limit exceeded', [
 *         'limit' => $rateLimit,
 *         'window' => '1 hour',
 *         'retryAfter' => 3600 // seconds
 *     ]);
 * }
 * </code>
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class TooManyRequestsException extends ApiException {
    
    /**
     * Constructor for TooManyRequestsException.
     *
     * @param string $message   Human-readable error message (default: 'Too Many Requests')
     * @param mixed  $debuginfo Optional debug information (e.g., limit, retry time)
     */
    public function __construct($message = 'Too Many Requests', $debuginfo = null) {
        parent::__construct($message, 'TOO_MANY_REQUESTS', 429, $debuginfo);
    }
}

