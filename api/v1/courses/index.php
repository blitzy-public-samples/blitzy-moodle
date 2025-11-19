<?php
/**
 * Courses List API Endpoint
 *
 * GET /api/v1/courses - Retrieve a paginated list of courses
 *
 * This endpoint provides access to the course catalog with support for
 * filtering, sorting, and pagination. It wraps the existing Moodle course
 * retrieval functionality without duplicating any business logic.
 *
 * @package    api
 * @subpackage v1
 * @copyright  2024 Moodle React Migration
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include required files
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/moodlelib.php');
require_once($CFG->dirroot . '/lib/datalib.php');
require_once($CFG->dirroot . '/course/externallib.php');
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Courses Index Endpoint Handler
 *
 * Handles GET requests to retrieve a list of courses with pagination support.
 * Delegates all business logic to existing Moodle core functions:
 * - get_courses() for basic course listing
 * - core_course_external::get_courses() for external API access
 *
 * Query Parameters:
 * - limitfrom: Starting offset for pagination (default: 0)
 * - limitnum: Number of records to return (default: 20, max: 100)
 * - categoryid: Filter by course category ID (optional)
 * - search: Search term for course name/summary (optional)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "fullname": "Course Name",
 *       "shortname": "COURSE101",
 *       "categoryid": 1,
 *       "summary": "Course description",
 *       "format": "topics",
 *       ...
 *     }
 *   ],
 *   "meta": {
 *     "pagination": {
 *       "page": 1,
 *       "perPage": 20,
 *       "total": 50,
 *       "totalPages": 3
 *     }
 *   }
 * }
 */
class CoursesIndexEndpoint extends ApiBase {
    
    /**
     * Handle GET requests to retrieve list of courses.
     *
     * This method:
     * 1. Validates JWT token and extracts authenticated user
     * 2. Checks user has permission to view course list
     * 3. Extracts and validates pagination parameters
     * 4. Calls existing Moodle get_courses() function
     * 5. Returns standardized JSON response with pagination metadata
     *
     * @return void Outputs JSON response and exits
     * @throws ApiException If validation fails or user lacks permissions
     */
    protected function handle_get() {
        global $CFG, $DB;

        try {
            // Get authenticated user from JWT token.
            $user = $this->getUser();
            if (!$user) {
                throw new UnauthorizedException('Authentication required');
            }

            // Check if user has permission to view courses.
            // Using system context to check general course viewing capability.
            $systemcontext = context_system::instance();
            $this->checkCapability('moodle/course:viewparticipants', $systemcontext);

            // Extract and validate pagination parameters.
            $limitfrom = $this->getParam('limitfrom', PARAM_INT, false, 0);
            $limitnum = $this->getParam('limitnum', PARAM_INT, false, 20);

            // Validate pagination parameters.
            if ($limitfrom < 0) {
                throw new ValidationException('Parameter limitfrom must be non-negative');
            }
            if ($limitnum < 1 || $limitnum > 100) {
                throw new ValidationException('Parameter limitnum must be between 1 and 100');
            }

            // Extract optional filter parameters.
            $categoryid = $this->getParam('categoryid', PARAM_INT, false, null);
            $search = $this->getParam('search', PARAM_TEXT, false, null);

            // Validate category ID if provided.
            if ($categoryid !== null && $categoryid < 0) {
                throw new ValidationException('Parameter categoryid must be non-negative');
            }

            // Use existing Moodle external API function to get courses.
            // This ensures all business logic, permissions, and data formatting
            // are handled by Moodle core without duplication.
            $options = [];
            
            // Build options array for filtering
            if ($search !== null && $search !== '') {
                $options['search'] = $search;
            }
            
            $courses = [];
            
            // If category filter is specified, get courses for that category
            if ($categoryid !== null) {
                // Validate that category exists
                if (!$DB->record_exists('course_categories', ['id' => $categoryid])) {
                    throw new NotFoundException('Course category not found');
                }
                
                // Get courses for specific category using core function
                $allcourses = get_courses($categoryid);
                
                // Convert to array format
                foreach ($allcourses as $course) {
                    $courses[] = (array)$course;
                }
            } else {
                // Get all courses using external API
                // This returns courses the user has access to
                $result = core_course_external::get_courses($options);
                $courses = $result;
            }

            // Apply search filter if specified and not already filtered by external API
            if ($search !== null && $search !== '' && $categoryid !== null) {
                $searchlower = strtolower($search);
                $courses = array_filter($courses, function($course) use ($searchlower) {
                    $fullname = isset($course['fullname']) ? strtolower($course['fullname']) : '';
                    $shortname = isset($course['shortname']) ? strtolower($course['shortname']) : '';
                    $summary = isset($course['summary']) ? strtolower($course['summary']) : '';
                    
                    return (strpos($fullname, $searchlower) !== false ||
                            strpos($shortname, $searchlower) !== false ||
                            strpos($summary, $searchlower) !== false);
                });
                // Re-index array after filtering
                $courses = array_values($courses);
            }

            // Calculate total before pagination
            $totalcount = count($courses);

            // Apply pagination to results
            $paginatedcourses = array_slice($courses, $limitfrom, $limitnum);

            // Calculate pagination metadata
            $page = ($limitfrom > 0 && $limitnum > 0) ? (int)floor($limitfrom / $limitnum) + 1 : 1;
            $totalpages = ($totalcount > 0 && $limitnum > 0) ? (int)ceil($totalcount / $limitnum) : 1;

            $meta = [
                'pagination' => [
                    'page' => $page,
                    'perPage' => $limitnum,
                    'total' => $totalcount,
                    'totalPages' => $totalpages
                ]
            ];

            // Return standardized success response with courses and metadata
            $this->success($paginatedcourses, 200, $meta);

        } catch (moodle_exception $e) {
            // Handle Moodle-specific exceptions
            if (strpos($e->getMessage(), 'nopermission') !== false) {
                throw new ForbiddenException('You do not have permission to view courses');
            } else if (strpos($e->getMessage(), 'notfound') !== false) {
                throw new NotFoundException('Course or category not found');
            } else {
                // Generic server error for unexpected Moodle exceptions
                throw new ServerException('Failed to retrieve courses: ' . $e->getMessage());
            }
        }
    }

    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for course listing');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for course listing');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for course listing');
    }
}

// Instantiate endpoint and execute request handling.

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new CoursesIndexEndpoint();
    $endpoint->execute();
}
