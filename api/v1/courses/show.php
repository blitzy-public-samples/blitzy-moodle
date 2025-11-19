<?php
/**
 * Course Detail API Endpoint
 *
 * GET /api/v1/courses/{id} - Retrieve detailed information about a specific course
 *
 * This endpoint provides access to complete course information including
 * course contents and activities. It wraps the existing Moodle course
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
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/course/externallib.php');
require_once($CFG->dirroot . '/api/lib/api_base.php');
require_once($CFG->dirroot . '/api/lib/api_exception.php');

/**
 * Course Show Endpoint Handler
 *
 * Handles GET requests to retrieve detailed information about a specific course.
 * Delegates all business logic to existing Moodle core functions:
 * - get_course() for basic course data
 * - core_course_external::get_course_contents() for course structure and activities
 *
 * URL Parameters:
 * - id: Course ID (required, from URL path)
 *
 * Query Parameters:
 * - include_contents: Include course contents/activities (default: true)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "course": {
 *       "id": 1,
 *       "fullname": "Course Name",
 *       "shortname": "COURSE101",
 *       "categoryid": 1,
 *       "summary": "Course description",
 *       "format": "topics",
 *       ...
 *     },
 *     "contents": [
 *       {
 *         "id": 1,
 *         "name": "Topic 1",
 *         "modules": [...]
 *       }
 *     ]
 *   }
 * }
 */
class CoursesShowEndpoint extends ApiBase {
    
    /**
     * Handle GET requests to retrieve a specific course.
     *
     * This method:
     * 1. Validates JWT token and extracts authenticated user
     * 2. Extracts and validates course ID from URL path
     * 3. Verifies course exists and is accessible
     * 4. Checks user has permission to view the course
     * 5. Calls existing Moodle get_course() and get_course_contents() functions
     * 6. Returns standardized JSON response with course data
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

            // Extract and validate course ID from URL path parameter.
            // The ID is expected to be passed via $_GET['id'] by the API router.
            $courseid = $this->getParam('id', PARAM_INT, true);

            // Validate that courseid is positive.
            if ($courseid <= 0) {
                throw new ValidationException('Invalid course ID');
            }

            // Verify the course exists using existing Moodle function.
            // get_course() throws an exception if course doesn't exist.
            try {
                $course = get_course($courseid);
            } catch (dml_missing_record_exception $e) {
                throw new NotFoundException('Course not found');
            }

            // Check if course is deleted (visible=0 typically means hidden, not deleted).
            // In Moodle, deleted courses are actually removed from the database.
            // However, we check the visible flag to handle hidden courses.
            if (!$course->visible) {
                // Check if user has permission to view hidden courses.
                $coursecontext = context_course::instance($courseid);
                if (!has_capability('moodle/course:viewhiddencourses', $coursecontext)) {
                    throw new NotFoundException('Course not found or not accessible');
                }
            }

            // Enforce permission check for viewing course content.
            $coursecontext = context_course::instance($courseid);
            
            // Check if user is enrolled or has general view capability.
            $enrolled = is_enrolled($coursecontext, $user->id);
            $canview = has_capability('moodle/course:view', $coursecontext);
            
            if (!$enrolled && !$canview) {
                throw new ForbiddenException('You do not have permission to view this course');
            }

            // Extract optional parameter for including course contents.
            $includecontents = $this->getParam('include_contents', PARAM_BOOL, false, true);

            // Prepare course data array.
            $coursedata = [
                'id' => $course->id,
                'fullname' => $course->fullname,
                'shortname' => $course->shortname,
                'categoryid' => $course->category,
                'summary' => $course->summary,
                'summaryformat' => $course->summaryformat,
                'format' => $course->format,
                'startdate' => $course->startdate,
                'enddate' => $course->enddate,
                'visible' => $course->visible,
                'lang' => $course->lang,
                'enablecompletion' => $course->enablecompletion,
            ];

            // Prepare response data.
            $responsedata = [
                'course' => $coursedata
            ];

            // Include course contents if requested.
            if ($includecontents) {
                try {
                    // Call existing Moodle external API to get course contents.
                    // This returns a structured array of course sections and activities.
                    $contents = core_course_external::get_course_contents($courseid);
                    $responsedata['contents'] = $contents;
                } catch (Exception $e) {
                    // If contents retrieval fails, log but don't fail the entire request.
                    // Return course data without contents.
                    $responsedata['contents'] = [];
                    $responsedata['contents_error'] = 'Failed to retrieve course contents';
                }
            }

            // Return standardized success response with course data.
            $this->success($responsedata, 200);

        } catch (moodle_exception $e) {
            // Handle Moodle-specific exceptions.
            if (strpos($e->getMessage(), 'nopermission') !== false || 
                strpos($e->getMessage(), 'nopermissions') !== false) {
                throw new ForbiddenException('You do not have permission to view this course');
            } else if (strpos($e->getMessage(), 'invalidrecord') !== false ||
                       strpos($e->getMessage(), 'notfound') !== false) {
                throw new NotFoundException('Course not found');
            } else {
                // Generic server error for unexpected Moodle exceptions.
                throw new ServerException('Failed to retrieve course: ' . $e->getMessage());
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
        throw new MethodNotAllowedException('POST method not supported for course detail');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for course detail');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for course detail');
    }
}

// Instantiate endpoint and execute request handling.

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new CoursesShowEndpoint();
    $endpoint->execute();
}
