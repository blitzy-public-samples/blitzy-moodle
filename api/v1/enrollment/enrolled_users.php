<?php
/**
 * API endpoint for retrieving enrolled users in a course
 *
 * This endpoint provides a RESTful interface to retrieve the list of users
 * enrolled in a specific course. It wraps the core Moodle web service function
 * core_enrol_external::get_enrolled_users() without reimplementing any business logic.
 *
 * @route GET /api/v1/enrollment/{courseid}/users
 * @capability moodle/course:viewparticipants
 * @package api
 * @subpackage enrollment
 * @copyright 2024 Moodle Pty Ltd
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 *
 * Query Parameters:
 * - onlyactive (bool): Filter for only active enrollments (default: false)
 * - groupid (int): Filter by group ID, 0 for all groups (default: 0)
 * - withcapability (string): Filter users with specific capability (default: '')
 * - userfields (string): Comma-separated list of user fields to return (default: '')
 * - limitfrom (int): Pagination offset, 0-based (default: 0)
 * - limitnumber (int): Number of records per page (default: 20)
 * - sortby (string): Sort field - id, firstname, lastname, siteorder (default: 'id')
 * - sortdirection (string): Sort direction - ASC or DESC (default: 'ASC')
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 123,
 *       "username": "student1",
 *       "firstname": "John",
 *       "lastname": "Doe",
 *       "email": "john.doe@example.com",
 *       "roles": [...]
 *     }
 *   ],
 *   "meta": {
 *     "pagination": {
 *       "page": 1,
 *       "perPage": 20,
 *       "total": 150,
 *       "totalPages": 8
 *     }
 *   }
 * }
 */

// Require Moodle configuration and initialization
require_once(__DIR__ . '/../../../config.php');

// Require core Moodle enrollment libraries
require_once($CFG->dirroot . '/lib/enrollib.php');
require_once($CFG->dirroot . '/enrol/externallib.php');

// Require API utility classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_response.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Endpoint class for retrieving enrolled users in a course
 *
 * This class extends ApiBase to provide a GET handler for the
 * /api/v1/enrollment/{courseid}/users endpoint. It enforces JWT authentication,
 * validates the moodle/course:viewparticipants capability, and delegates all
 * business logic to the existing core_enrol_external::get_enrolled_users() function.
 */
class EnrolledUsersEndpoint extends ApiBase {
    
    /**
     * Handle GET request for /api/v1/enrollment/{courseid}/users
     *
     * This method:
     * 1. Extracts courseid from the URI path
     * 2. Validates the course exists
     * 3. Creates course context and checks viewparticipants capability
     * 4. Extracts and validates query parameters for filtering and pagination
     * 5. Builds options array for the web service function
     * 6. Calls core_enrol_external::get_enrolled_users() (thin wrapper pattern)
     * 7. Counts total enrolled users for pagination metadata
     * 8. Formats pagination metadata using ApiResponse::formatPagination()
     * 9. Returns success response with users and pagination data
     * 10. Handles all exceptions with appropriate HTTP status codes
     *
     * @return void Outputs JSON response directly
     * @throws ValidationException If URI format invalid or parameters invalid (400)
     * @throws NotFoundException If course with specified ID not found (404)
     * @throws ForbiddenException If user lacks viewparticipants capability (403)
     * @throws ServerException For unexpected errors (500)
     */
    protected function handle_get() {
        global $DB;
        
        try {
            // ========================================================================
            // STEP 1: Extract courseid from URI path
            // ========================================================================
            // URI pattern: /api/v1/enrollment/{courseid}/users
            // Use regex to extract the numeric courseid from the request URI
            if (preg_match('#/api/v1/enrollment/(\d+)/users#', $this->requestUri, $matches)) {
                $courseid = (int)$matches[1];
            } else {
                throw new ValidationException(
                    'Invalid URI format. Expected: /api/v1/enrollment/{courseid}/users where courseid is numeric'
                );
            }
            
            // Validate courseid is positive integer
            if ($courseid <= 0) {
                throw new ValidationException('Course ID must be a positive integer');
            }
            
            // ========================================================================
            // STEP 2: Validate course exists in database
            // ========================================================================
            // Use existing Moodle database function to verify course exists
            // MUST_EXIST flag will throw dml_missing_record_exception if not found
            try {
                $course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);
            } catch (dml_missing_record_exception $e) {
                throw new NotFoundException("Course with ID {$courseid} not found");
            }
            
            // ========================================================================
            // STEP 3: Create course context and enforce capability
            // ========================================================================
            // Create context for the course - required for permission checking
            $context = context_course::instance($courseid);
            
            // Check if current user has permission to view course participants
            // This wraps require_capability() and throws ForbiddenException on denial
            $this->checkCapability('moodle/course:viewparticipants', $context);
            
            // ========================================================================
            // STEP 4: Extract and validate query parameters
            // ========================================================================
            // Extract filtering parameters with type validation
            // getParam() provides type-safe extraction with defaults
            
            // Filter for only active enrollments (not suspended/expired)
            $onlyactive = $this->getParam('onlyactive', PARAM_BOOL, false, false);
            
            // Filter by group ID (0 = all groups, positive int = specific group)
            $groupid = $this->getParam('groupid', PARAM_INT, 0, false);
            
            // Filter by users having a specific capability (e.g., 'mod/assign:submit')
            $withcapability = $this->getParam('withcapability', PARAM_ALPHANUMEXT, '', false);
            
            // Comma-separated list of user fields to include in response
            // Empty string = default fields (id, username, firstname, lastname, email)
            $userfields = $this->getParam('userfields', PARAM_RAW, '', false);
            
            // Pagination parameters
            // limitfrom: 0-based offset for pagination (0 = start from first record)
            $limitfrom = $this->getParam('limitfrom', PARAM_INT, 0, false);
            
            // limitnumber: number of records to return per page
            $limitnumber = $this->getParam('limitnumber', PARAM_INT, 20, false);
            
            // Sorting parameters (Note: sorting is handled by the web service function)
            $sortby = $this->getParam('sortby', PARAM_ALPHANUMEXT, 'id', false);
            $sortdirection = $this->getParam('sortdirection', PARAM_ALPHANUMEXT, 'ASC', false);
            
            // Validate pagination parameters are non-negative
            if ($limitfrom < 0) {
                throw new ValidationException('limitfrom must be non-negative');
            }
            if ($limitnumber < 0) {
                throw new ValidationException('limitnumber must be non-negative');
            }
            
            // Validate sort direction is either ASC or DESC
            $sortdirection = strtoupper($sortdirection);
            if ($sortdirection !== 'ASC' && $sortdirection !== 'DESC') {
                throw new ValidationException('sortdirection must be either ASC or DESC');
            }
            
            // ========================================================================
            // STEP 5: Build options array for core_enrol_external::get_enrolled_users()
            // ========================================================================
            // The web service function expects options as an array of name/value pairs
            // Format: [['name' => 'optionname', 'value' => value], ...]
            $options = [];
            
            // Add onlyactive filter if requested
            if ($onlyactive) {
                $options[] = ['name' => 'onlyactive', 'value' => 1];
            }
            
            // Add group filter if specific group requested
            if ($groupid > 0) {
                $options[] = ['name' => 'groupid', 'value' => $groupid];
            }
            
            // Add capability filter if specified
            if (!empty($withcapability)) {
                $options[] = ['name' => 'withcapability', 'value' => $withcapability];
            }
            
            // Add user fields filter if specified
            // The web service expects an array of field names, not comma-separated string
            if (!empty($userfields)) {
                // Convert comma-separated string to array and trim whitespace
                $fieldsArray = array_map('trim', explode(',', $userfields));
                // Filter out empty strings after trimming
                $fieldsArray = array_filter($fieldsArray, function($field) {
                    return !empty($field);
                });
                if (!empty($fieldsArray)) {
                    $options[] = ['name' => 'userfields', 'value' => $fieldsArray];
                }
            }
            
            // Add pagination parameters
            // Note: limitfrom and limitnumber are handled even if 0 to ensure consistent behavior
            if ($limitfrom >= 0) {
                $options[] = ['name' => 'limitfrom', 'value' => $limitfrom];
            }
            
            if ($limitnumber > 0) {
                $options[] = ['name' => 'limitnumber', 'value' => $limitnumber];
            }
            
            // ========================================================================
            // STEP 6: Call core_enrol_external::get_enrolled_users()
            // ========================================================================
            // CRITICAL: This is a THIN WRAPPER - we delegate ALL business logic to
            // the existing Moodle web service function. We do NOT reimplement any
            // enrollment logic, database queries, or permission checks beyond the
            // initial capability check above.
            //
            // The function returns an array of user objects with enrollment details
            $users = core_enrol_external::get_enrolled_users($courseid, $options);
            
            // ========================================================================
            // STEP 7: Count total enrolled users for pagination metadata
            // ========================================================================
            // Use existing count_enrolled_users() function from enrollib.php
            // This provides the total count of users matching the filters, which is
            // needed to calculate the total number of pages for pagination
            
            // Convert groupid to format expected by count_enrolled_users()
            // 0 means all groups, positive int means specific group
            $groupids = $groupid > 0 ? $groupid : 0;
            
            // Call existing Moodle function to count users
            $totalCount = count_enrolled_users($context, $withcapability, $groupids, $onlyactive);
            
            // ========================================================================
            // STEP 8: Calculate pagination metadata
            // ========================================================================
            // Determine the effective per-page limit (default to 20 if not specified)
            $perPage = $limitnumber > 0 ? $limitnumber : 20;
            
            // Calculate current page number from offset and per-page limit
            // Page numbering is 1-based (first page is page 1, not page 0)
            // Formula: page = floor(offset / perPage) + 1
            // Examples:
            //   limitfrom=0, perPage=20 => page 1
            //   limitfrom=20, perPage=20 => page 2
            //   limitfrom=40, perPage=20 => page 3
            $page = $limitfrom > 0 ? floor($limitfrom / $perPage) + 1 : 1;
            
            // Format pagination metadata using ApiResponse utility
            // This calculates totalPages automatically: ceil(total / perPage)
            $paginationMeta = ApiResponse::formatPagination($page, $perPage, $totalCount);
            
            // ========================================================================
            // STEP 9: Return success response
            // ========================================================================
            // Return HTTP 200 with success response envelope containing:
            // - data: array of user objects from the web service
            // - meta: pagination metadata object
            return $this->success($users, 200, ['pagination' => $paginationMeta]);
            
        } catch (NotFoundException $e) {
            // Re-throw API exceptions without modification
            // These already have the correct HTTP status codes
            throw $e;
            
        } catch (ForbiddenException $e) {
            // Re-throw permission denied exceptions
            throw $e;
            
        } catch (ValidationException $e) {
            // Re-throw validation exceptions
            throw $e;
            
        } catch (moodle_exception $e) {
            // Convert Moodle-specific exceptions to appropriate API exceptions
            
            if ($e instanceof dml_missing_record_exception) {
                // Database record not found -> 404 Not Found
                throw new NotFoundException('Resource not found: ' . $e->getMessage());
                
            } else if ($e instanceof required_capability_exception) {
                // Permission denied -> 403 Forbidden
                throw new ForbiddenException('Permission denied: ' . $e->getMessage());
                
            } else if ($e instanceof invalid_parameter_exception) {
                // Invalid parameter -> 400 Bad Request
                throw new ValidationException('Invalid parameter: ' . $e->getMessage());
                
            } else {
                // Other Moodle exceptions -> 500 Internal Server Error
                // Log the full exception for debugging
                if (debugging()) {
                    debugging('Moodle exception in enrolled_users endpoint: ' . $e->getMessage(), DEBUG_DEVELOPER);
                }
                throw new ServerException('An error occurred while retrieving enrolled users: ' . $e->getMessage());
            }
            
        } catch (Exception $e) {
            // Catch-all for unexpected errors
            // Log the exception for debugging
            if (debugging()) {
                debugging('Unexpected exception in enrolled_users endpoint: ' . $e->getMessage(), DEBUG_DEVELOPER);
            }
            throw new ServerException('Unexpected error: ' . $e->getMessage());
        }
    }
}

// ============================================================================
// Endpoint Execution
// ============================================================================
// Instantiate the endpoint class and execute the request
// The execute() method in ApiBase will:
// 1. Validate JWT token and extract authenticated user
// 2. Route to appropriate HTTP method handler (handle_get in this case)
// 3. Handle any exceptions and format error responses
// 4. Output JSON response with appropriate HTTP headers
$endpoint = new EnrolledUsersEndpoint();
$endpoint->execute();
