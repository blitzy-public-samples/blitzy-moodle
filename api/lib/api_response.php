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
 * Standard JSON response formatter for REST API endpoints.
 *
 * This class provides a consistent envelope structure for all API responses,
 * ensuring predictable response formats for the React frontend. All responses
 * follow either the success pattern {success: true, data, meta} or the error
 * pattern {success: false, error: {code, message, details}}.
 *
 * Key features:
 * - Consistent JSON envelope structure across all endpoints
 * - Proper HTTP status code handling via http_response_code()
 * - Support for pagination metadata on list endpoints
 * - Integration with ApiException for automatic error response generation
 * - Character encoding support (UTF-8, unescaped slashes)
 * - Shorthand methods for common HTTP status codes (404, 401, 403, etc.)
 *
 * Example usage:
 * <code>
 * // Success response with data
 * ApiResponse::success(['course' => $coursedata], 200);
 *
 * // Success response with pagination
 * $meta = ['pagination' => ApiResponse::formatPagination(1, 20, 150)];
 * ApiResponse::success($courses, 200, $meta);
 *
 * // Error response
 * ApiResponse::error('NOT_FOUND', 'Course not found', 404);
 *
 * // From exception
 * try {
 *     // API operation
 * } catch (ApiException $e) {
 *     ApiResponse::fromException($e);
 * }
 * </code>
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include Moodle configuration
require_once(__DIR__ . '/../../config.php');

require_once(__DIR__ . '/api_exception.php');

/**
 * Standard JSON response formatter for REST API endpoints.
 *
 * This class enforces consistent response structures across all API endpoints,
 * ensuring that the React frontend can reliably parse and handle responses.
 * All methods are static as this is a utility class with no instance state.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class ApiResponse {
    
    /**
     * Send a successful JSON response.
     *
     * Creates a standardized success response envelope with the provided data
     * and optional metadata. Sets the appropriate HTTP status code and
     * Content-Type header before outputting JSON and terminating execution.
     *
     * Response structure:
     * {
     *   "success": true,
     *   "data": <provided data>,
     *   "meta": <optional metadata>
     * }
     *
     * @param mixed $data    The data payload to return (array, object, or primitive)
     * @param int   $status  HTTP status code (default: 200 OK)
     * @param array $meta    Optional metadata (e.g., pagination info)
     * @return void          This method terminates script execution after sending response
     */
    public static function success($data, $status = 200, $meta = null) {
        $response = [
            'success' => true,
            'data' => $data,
        ];
        
        // Include metadata if provided (e.g., pagination)
        if ($meta !== null) {
            $response['meta'] = $meta;
        }
        
        self::json($response, $status);
    }
    
    /**
     * Send an error JSON response.
     *
     * Creates a standardized error response envelope with error code, message,
     * and optional details. Sets the appropriate HTTP status code and
     * Content-Type header before outputting JSON and terminating execution.
     *
     * Response structure:
     * {
     *   "success": false,
     *   "error": {
     *     "code": <error code>,
     *     "message": <error message>,
     *     "details": <optional details>
     *   }
     * }
     *
     * @param string $code    Machine-readable error code (e.g., 'NOT_FOUND', 'VALIDATION_ERROR')
     * @param string $message Human-readable error message
     * @param int    $status  HTTP status code (default: 500 Internal Server Error)
     * @param mixed  $details Optional additional error details (array, string, or object)
     * @return void           This method terminates script execution after sending response
     */
    public static function error($code, $message, $status = 500, $details = null) {
        $response = [
            'success' => false,
            'error' => [
                'code' => $code,
                'message' => $message,
            ],
        ];
        
        // Include error details if provided
        if ($details !== null) {
            $response['error']['details'] = $details;
        }
        
        self::json($response, $status);
    }
    
    /**
     * Send a 201 Created response for successful resource creation.
     *
     * Used when a new resource has been successfully created (e.g., new course,
     * new user, new assignment submission). Optionally sets the Location header
     * to point to the newly created resource's URI.
     *
     * @param mixed  $data     The created resource data
     * @param string $location Optional URI of the newly created resource (for Location header)
     * @return void            This method terminates script execution after sending response
     */
    public static function created($data, $location = null) {
        // Set Location header if provided
        if ($location !== null) {
            header('Location: ' . $location);
        }
        
        self::success($data, 201);
    }
    
    /**
     * Send a 204 No Content response.
     *
     * Used when an operation completed successfully but there is no content
     * to return in the response body (e.g., successful DELETE operations,
     * or UPDATE operations where the client already has the updated data).
     *
     * @return void This method terminates script execution after sending response
     */
    public static function noContent() {
        http_response_code(204);
        exit;
    }
    
    /**
     * Send a 404 Not Found error response.
     *
     * Shorthand method for resource not found errors. Commonly used when
     * a requested course, user, assignment, or other resource does not exist.
     *
     * @param string $message Human-readable error message (default: 'Resource not found')
     * @return void           This method terminates script execution after sending response
     */
    public static function notFound($message = 'Resource not found') {
        self::error('NOT_FOUND', $message, 404);
    }
    
    /**
     * Send a 401 Unauthorized error response.
     *
     * Shorthand method for authentication failures. Used when JWT token is
     * missing, invalid, or expired. Indicates the client must authenticate
     * (or re-authenticate) before accessing the resource.
     *
     * @param string $message Human-readable error message (default: 'Unauthorized')
     * @return void           This method terminates script execution after sending response
     */
    public static function unauthorized($message = 'Unauthorized') {
        self::error('UNAUTHORIZED', $message, 401);
    }
    
    /**
     * Send a 403 Forbidden error response.
     *
     * Shorthand method for authorization failures. Used when the authenticated
     * user does not have permission to perform the requested operation.
     * Unlike 401, this indicates authentication succeeded but authorization failed.
     *
     * @param string $message Human-readable error message (default: 'Forbidden')
     * @return void           This method terminates script execution after sending response
     */
    public static function forbidden($message = 'Forbidden') {
        self::error('FORBIDDEN', $message, 403);
    }
    
    /**
     * Send a 400 Bad Request response for validation errors.
     *
     * Used when client input fails validation. The $errors parameter should
     * contain field-level validation errors to help the client correct the input.
     *
     * Response structure:
     * {
     *   "success": false,
     *   "error": {
     *     "code": "VALIDATION_ERROR",
     *     "message": "Validation failed",
     *     "details": {
     *       "errors": <field-level errors>
     *     }
     *   }
     * }
     *
     * Example $errors format:
     * [
     *   "email" => "Invalid email format",
     *   "password" => "Password must be at least 8 characters",
     *   "courseid" => "Course does not exist"
     * ]
     *
     * @param array $errors Associative array of field names to error messages
     * @return void         This method terminates script execution after sending response
     */
    public static function validationError($errors) {
        $details = [
            'errors' => $errors,
        ];
        
        self::error('VALIDATION_ERROR', 'Validation failed', 400, $details);
    }
    
    /**
     * Format pagination metadata for list endpoints.
     *
     * Generates a standardized pagination metadata object that can be included
     * in the response meta field. The React frontend uses this to render
     * pagination controls and track the current page state.
     *
     * Returned structure:
     * {
     *   "page": <current page>,
     *   "perPage": <items per page>,
     *   "total": <total items>,
     *   "totalPages": <total pages>
     * }
     *
     * @param int $page    Current page number (1-indexed)
     * @param int $perPage Number of items per page
     * @param int $total   Total number of items across all pages
     * @return array       Pagination metadata array
     */
    public static function formatPagination($page, $perPage, $total) {
        // Calculate total pages, ensuring at least 1 page even if no items
        $totalPages = $total > 0 ? (int) ceil($total / $perPage) : 1;
        
        return [
            'page' => (int) $page,
            'perPage' => (int) $perPage,
            'total' => (int) $total,
            'totalPages' => $totalPages,
        ];
    }
    
    /**
     * Convert an ApiException to a standardized error response.
     *
     * This method provides seamless integration with the ApiException hierarchy,
     * automatically extracting HTTP status codes, error codes, messages, and
     * details from the exception and formatting them into the standard error
     * response envelope.
     *
     * This is the recommended way to handle exceptions in API endpoints:
     * <code>
     * try {
     *     // API operation that may throw ApiException
     *     $course = get_course($id);
     *     if (!$course) {
     *         throw new NotFoundException('Course not found');
     *     }
     * } catch (ApiException $e) {
     *     ApiResponse::fromException($e);
     * }
     * </code>
     *
     * The method uses the exception's:
     * - getHttpStatus() for HTTP status code
     * - getErrorCode() for the error code string
     * - getMessage() for the error message
     * - getDetails() for additional error details (if in development mode)
     *
     * @param ApiException $e The API exception to convert to error response
     * @return void           This method terminates script execution after sending response
     */
    public static function fromException(ApiException $e) {
        global $CFG;
        
        $httpStatus = $e->getHttpStatus();
        $errorCode = $e->getErrorCode();
        $message = $e->getMessage();
        
        // Get detailed error information
        $details = null;
        
        // Include debug details only in development mode for security
        if (isset($CFG->debug) && $CFG->debug === DEBUG_DEVELOPER) {
            $exceptionDetails = $e->getDetails();
            
            // Extract relevant debug information
            $details = [
                'file' => $exceptionDetails['file'],
                'line' => $exceptionDetails['line'],
            ];
            
            // Include additional debug info if present
            if (isset($exceptionDetails['debugInfo'])) {
                $details['debugInfo'] = $exceptionDetails['debugInfo'];
            }
        }
        
        // Send standardized error response
        self::error($errorCode, $message, $httpStatus, $details);
    }
    
    /**
     * Output JSON response and terminate script execution.
     *
     * This private helper method handles the actual JSON encoding and output.
     * It sets the appropriate HTTP status code, Content-Type header, encodes
     * the response data to JSON with proper character encoding options, and
     * terminates script execution to prevent any additional output.
     *
     * JSON encoding options:
     * - JSON_UNESCAPED_SLASHES: Prevents escaping of forward slashes in URLs
     * - JSON_UNESCAPED_UNICODE: Outputs UTF-8 characters directly instead of \uXXXX escapes
     *
     * These options ensure readable JSON output and proper handling of
     * international characters and URLs.
     *
     * @param array $response The response array to encode as JSON
     * @param int   $status   HTTP status code to send
     * @return void           This method terminates script execution after output
     */
    private static function json($response, $status) {
        // Set HTTP status code
        http_response_code($status);
        
        // Set Content-Type header to application/json with UTF-8 charset
        header('Content-Type: application/json; charset=utf-8');
        
        // Encode response to JSON with proper options for readability and character handling
        $json = json_encode($response, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        
        // Handle JSON encoding errors
        if ($json === false) {
            // If JSON encoding fails, send a generic error response
            http_response_code(500);
            $fallbackResponse = [
                'success' => false,
                'error' => [
                    'code' => 'JSON_ENCODING_ERROR',
                    'message' => 'Failed to encode response to JSON',
                ],
            ];
            $json = json_encode($fallbackResponse);
        }
        
        // Output JSON and terminate execution
        echo $json;
        exit;
    }
}
