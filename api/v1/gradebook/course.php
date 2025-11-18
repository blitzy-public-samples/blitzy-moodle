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
 * REST API endpoint for retrieving course-level gradebook data.
 *
 * This endpoint provides access to complete gradebook information for a specific
 * course, including all grade items, scales, grade ranges, and individual student
 * grades with formatted display strings. It wraps the existing Moodle
 * grade_get_course_grades() function without duplicating any business logic.
 *
 * Endpoint: GET /api/v1/gradebook/course/{id}
 *
 * Query Parameters:
 *   - userid (optional, int): Specific user ID to get grades for. If omitted,
 *                             returns grade item information only without user grades.
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "scaleid": int|null,         // Scale ID if grade item uses a scale
 *     "name": string,               // Grade item name (typically course name)
 *     "grademin": float,            // Minimum possible grade
 *     "grademax": float,            // Maximum possible grade
 *     "gradepass": float,           // Passing grade threshold
 *     "locked": bool,               // Whether grade item is locked
 *     "hidden": bool,               // Whether grade item is hidden
 *     "grades": {                   // User grades (empty if userid not provided)
 *       "userid": {
 *         "grade": float|null,      // Raw numeric grade
 *         "locked": bool,           // Whether this grade is locked
 *         "hidden": bool,           // Whether this grade is hidden
 *         "overridden": int,        // Timestamp if grade was manually overridden
 *         "feedback": string,       // Feedback text
 *         "feedbackformat": int,    // Text format constant
 *         "usermodified": int,      // User ID who last modified
 *         "dategraded": int,        // Timestamp of grading
 *         "datesubmitted": int,     // Timestamp of submission
 *         "str_grade": string,      // Formatted grade for display
 *         "str_long_grade": string, // Long format grade (e.g., "85 / 100")
 *         "str_feedback": string    // Formatted feedback HTML
 *       }
 *     }
 *   }
 * }
 *
 * Security:
 *   - Requires JWT authentication
 *   - Enforces moodle/grade:view capability in course context
 *   - Uses existing Moodle permission checking (no logic duplication)
 *
 * Error Responses:
 *   - 400 Bad Request: Invalid courseid parameter (non-numeric or missing)
 *   - 401 Unauthorized: Missing or invalid JWT token
 *   - 403 Forbidden: User lacks moodle/grade:view capability
 *   - 404 Not Found: Course does not exist or has no grade data
 *   - 500 Internal Server Error: Unexpected server error
 *
 * Example Usage:
 *   GET /api/v1/gradebook/course/5
 *   GET /api/v1/gradebook/course/5?userid=123
 *
 * @package    core_grades
 * @category   api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and initialize environment
require_once(__DIR__ . '/../../../config.php');

// Load core grade libraries (existing Moodle functions - no duplication)
require_once($CFG->libdir . '/gradelib.php');
require_once($CFG->dirroot . '/grade/querylib.php');

// Load API infrastructure
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Course gradebook API endpoint implementation.
 *
 * Extends ApiBase to provide RESTful access to course-level gradebook data.
 * This is a thin wrapper around grade_get_course_grades() that handles:
 * - JWT authentication via ApiBase
 * - Permission enforcement via moodle/grade:view capability
 * - Parameter extraction and validation from URI and query string
 * - Error handling with appropriate HTTP status codes
 * - JSON response formatting
 *
 * All grade calculations, data retrieval, and business logic are delegated
 * to existing Moodle core functions. This class contains NO grade calculation
 * logic, ensuring complete consistency with the PHP gradebook interface.
 */
class CourseGradebookEndpoint extends ApiBase {
    
    /**
     * Handle GET request for course gradebook data.
     *
     * Extracts courseid from URI path (/api/v1/gradebook/course/{id}), validates
     * user has moodle/grade:view capability in the course context, and returns
     * JSON-formatted gradebook data by calling grade_get_course_grades().
     *
     * The method performs these steps:
     * 1. Extract courseid from request URI path
     * 2. Validate courseid is a positive integer
     * 3. Verify course exists in database
     * 4. Check user has moodle/grade:view capability in course context
     * 5. Extract optional userid parameter from query string
     * 6. Call grade_get_course_grades() to retrieve grade data
     * 7. Format and return JSON response
     *
     * @return void Outputs JSON response directly via success() method
     * @throws ValidationException If courseid is invalid or missing from URI
     * @throws NotFoundException If course does not exist or has no grade data
     * @throws ForbiddenException If user lacks moodle/grade:view capability
     */
    protected function handle_get() {
        global $DB;
        
        // Extract courseid from URI path
        // Expected URI format: /api/v1/gradebook/course/{id}
        // Example: /api/v1/gradebook/course/5 -> courseid = 5
        $courseid = $this->extractCourseIdFromUri();
        
        // Validate courseid is a positive integer
        if (!is_numeric($courseid) || $courseid <= 0) {
            throw new ValidationException('Invalid course ID', [
                'parameter' => 'id',
                'value' => $courseid,
                'expected' => 'Positive integer course ID'
            ]);
        }
        
        // Convert to integer (defensive programming)
        $courseid = (int)$courseid;
        
        // Verify course exists using existing Moodle function
        // get_course() throws moodle_exception if course doesn't exist (MUST_EXIST)
        // This is the proper Moodle way to validate and retrieve courses
        try {
            $course = get_course($courseid);
        } catch (moodle_exception $e) {
            // Convert Moodle exception to API NotFoundException for 404 response
            throw new NotFoundException('Course not found', [
                'courseid' => $courseid,
                'reason' => 'No course exists with this ID',
                'errorcode' => $e->errorcode
            ]);
        }
        
        // Get course context for permission checking
        $context = context_course::instance($courseid);
        
        // Enforce moodle/grade:view capability
        // This uses Moodle's existing capability system - no permission logic duplication
        // Throws ForbiddenException if user lacks permission (handled by ApiBase)
        $this->checkCapability('moodle/grade:view', $context);
        
        // Extract optional userid parameter from query string
        // If provided, returns grades for that specific user
        // If omitted, returns only grade item information without user grades
        $userid = $this->getParam('userid', PARAM_INT, false, null);
        
        // Validate userid if provided
        if ($userid !== null && (!is_numeric($userid) || $userid <= 0)) {
            throw new ValidationException('Invalid user ID', [
                'parameter' => 'userid',
                'value' => $userid,
                'expected' => 'Positive integer user ID or omit parameter'
            ]);
        }
        
        // Call existing Moodle function to retrieve grade data
        // This is the ONLY source of grade data - no calculations performed here
        // Ensures 100% consistency with PHP gradebook results
        $gradedata = grade_get_course_grades($courseid, $userid);
        
        // Verify grade data was returned
        if (!$gradedata) {
            throw new NotFoundException('Grade data not found', [
                'courseid' => $courseid,
                'userid' => $userid,
                'reason' => 'No grade item found for this course'
            ]);
        }
        
        // Convert stdClass to associative array for JSON serialization
        // Preserve all properties returned by grade_get_course_grades():
        // - scaleid: Scale ID if using a scale, 0 for numeric grades
        // - name: Grade item name (typically course full name)
        // - grademin: Minimum possible grade value
        // - grademax: Maximum possible grade value
        // - gradepass: Passing grade threshold
        // - locked: Whether grade item is locked (boolean)
        // - hidden: Whether grade item is hidden (boolean)
        // - grades: Array of user grades indexed by userid
        $response = [
            'scaleid' => $gradedata->scaleid,
            'name' => $gradedata->name,
            'grademin' => $gradedata->grademin,
            'grademax' => $gradedata->grademax,
            'gradepass' => $gradedata->gradepass,
            'locked' => $gradedata->locked,
            'hidden' => $gradedata->hidden,
            'grades' => []
        ];
        
        // Process user grades if present
        // Each grade contains:
        // - grade: Raw numeric grade value or null if not graded
        // - locked: Whether this specific grade is locked
        // - hidden: Whether this specific grade is hidden
        // - overridden: Timestamp if grade was manually overridden, 0 otherwise
        // - feedback: Feedback text (may be null)
        // - feedbackformat: Text format constant (FORMAT_PLAIN, FORMAT_HTML, etc.)
        // - usermodified: User ID of person who last modified the grade
        // - dategraded: Unix timestamp when grade was last modified
        // - datesubmitted: Unix timestamp when student submitted work
        // - str_grade: Formatted grade string for display (e.g., "85.00", "B+", "-")
        // - str_long_grade: Long format display (e.g., "85.00 / 100.00")
        // - str_feedback: HTML-formatted feedback for display
        if (!empty($gradedata->grades)) {
            foreach ($gradedata->grades as $uid => $grade) {
                $response['grades'][$uid] = [
                    'grade' => $grade->grade,
                    'locked' => $grade->locked,
                    'hidden' => $grade->hidden,
                    'overridden' => $grade->overridden,
                    'feedback' => $grade->feedback,
                    'feedbackformat' => $grade->feedbackformat,
                    'usermodified' => $grade->usermodified,
                    'dategraded' => $grade->dategraded,
                    'datesubmitted' => $grade->datesubmitted,
                    'str_grade' => $grade->str_grade,
                    'str_long_grade' => $grade->str_long_grade,
                    'str_feedback' => $grade->str_feedback
                ];
            }
        }
        
        // Send success response with grade data
        // HTTP 200 OK with JSON body containing gradebook information
        $this->success($response);
    }
    
    /**
     * Extract course ID from request URI path.
     *
     * Parses the request URI to extract the courseid parameter from the path.
     * Expected URI format: /api/v1/gradebook/course/{id}
     *
     * Examples:
     *   - /api/v1/gradebook/course/5 -> returns "5"
     *   - /api/v1/gradebook/course/123?userid=45 -> returns "123"
     *   - /path/to/moodle/api/v1/gradebook/course/999 -> returns "999"
     *
     * @return string The course ID extracted from URI path (as string, not yet validated)
     * @throws ValidationException If courseid cannot be extracted from URI
     */
    private function extractCourseIdFromUri() {
        // Get request URI from server variables
        $uri = $this->requestUri;
        
        // Remove query string if present
        // Example: "/api/v1/gradebook/course/5?userid=10" -> "/api/v1/gradebook/course/5"
        $path = parse_url($uri, PHP_URL_PATH);
        
        // Match pattern: /api/v1/gradebook/course/{courseid}
        // Use regex to extract courseid from path
        // Pattern explanation:
        //   .* - Match any characters before api (handles full URL or relative path)
        //   \/api\/v1\/gradebook\/course\/ - Match the endpoint path
        //   ([^\/\?]+) - Capture group: one or more characters that are not / or ?
        if (preg_match('#/api/v1/gradebook/course/([^/\?]+)#', $path, $matches)) {
            return $matches[1];
        }
        
        // If courseid not found in URI, throw validation exception
        throw new ValidationException('Course ID not found in request URI', [
            'uri' => $uri,
            'path' => $path,
            'expected' => '/api/v1/gradebook/course/{id}',
            'reason' => 'URI must include numeric course ID in path'
        ]);
    }
    
    /**
     * Handle POST request - not supported.
     *
     * POST method is not allowed for grade retrieval. Grade creation/updates
     * are handled by separate endpoints (e.g., /api/v1/gradebook/update_grade).
     *
     * @throws MethodNotAllowedException Always thrown (handled by ApiBase)
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for gradebook retrieval');
    }
    
    /**
     * Handle PUT request - not supported.
     *
     * PUT method is not allowed for this endpoint. Grade updates are handled
     * by /api/v1/gradebook/update_grade endpoint.
     *
     * @throws MethodNotAllowedException Always thrown (handled by ApiBase)
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for gradebook retrieval');
    }
    
    /**
     * Handle DELETE request - not supported.
     *
     * DELETE method is not allowed for gradebook data.
     *
     * @throws MethodNotAllowedException Always thrown (handled by ApiBase)
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for gradebook retrieval');
    }
}

// Instantiate endpoint and execute request
// ApiBase::execute() handles:
// - JWT authentication
// - HTTP method routing to handle_get()
// - Exception catching and error response formatting
// - CORS headers
$endpoint = new CourseGradebookEndpoint();
$endpoint->execute();
