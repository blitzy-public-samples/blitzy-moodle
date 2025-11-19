<?php
/**
 * Course Contents API Endpoint
 *
 * GET /api/v1/courses/{id}/contents - Retrieve course contents and structure
 *
 * This endpoint provides access to course structure, sections, and activities.
 * It wraps the existing Moodle course content retrieval functionality without
 * duplicating any business logic.
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
 * Course Contents Endpoint Handler
 *
 * Handles GET requests to retrieve course structure and contents.
 * Delegates all business logic to existing Moodle core functions:
 * - core_course_external::get_course_contents() for full course structure
 * - get_fast_modinfo() for course module information
 *
 * URL Parameters:
 * - id: Course ID (required, from URL path)
 *
 * Query Parameters:
 * - options: Array of options (optional)
 *   - excludemodules: Exclude module information (boolean)
 *   - excludecontents: Exclude file contents (boolean)
 *   - sectionid: Specific section ID to retrieve (int)
 *   - sectionnumber: Specific section number to retrieve (int)
 *   - cmid: Specific course module ID to retrieve (int)
 *   - modname: Filter by module name (string)
 *   - modid: Filter by module instance ID (int)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "courseid": 123,
 *     "sections": [
 *       {
 *         "id": 1,
 *         "name": "Topic 1",
 *         "summary": "Section summary...",
 *         "modules": [
 *           {
 *             "id": 10,
 *             "name": "Assignment 1",
 *             "modname": "assign",
 *             "visible": 1,
 *             ...
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * }
 */
class CoursesContentsEndpoint extends ApiBase {
    
    /**
     * Handle GET requests to retrieve course contents.
     *
     * This method:
     * 1. Validates JWT token and extracts authenticated user
     * 2. Extracts and validates course ID from URL path
     * 3. Verifies course exists and user has access to view it
     * 4. Extracts optional filter parameters
     * 5. Calls existing Moodle get_course_contents() function
     * 6. Returns standardized JSON response with course structure
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
            $courseid = $this->getParam('id', PARAM_INT, true);

            // Validate that courseid is positive.
            if ($courseid <= 0) {
                throw new ValidationException('Invalid course ID');
            }

            // Verify the course exists.
            try {
                $course = get_course($courseid);
            } catch (dml_missing_record_exception $e) {
                throw new NotFoundException('Course not found');
            }

            // Check if user has access to view the course.
            $coursecontext = context_course::instance($courseid);
            
            // User must be enrolled or have capability to view hidden courses.
            $isenrolled = is_enrolled($coursecontext, $user->id, '', true);
            $canviewhidden = has_capability('moodle/course:viewhiddencourses', $coursecontext);
            
            if (!$isenrolled && !$canviewhidden) {
                throw new ForbiddenException('You do not have access to view this course');
            }

            // Check course visibility for non-privileged users.
            if (!$course->visible && !$canviewhidden) {
                throw new ForbiddenException('This course is not visible');
            }

            // Extract optional filter parameters from query string.
            $excludemodules = $this->getParam('excludemodules', PARAM_BOOL, false, false);
            $excludecontents = $this->getParam('excludecontents', PARAM_BOOL, false, false);
            $sectionid = $this->getParam('sectionid', PARAM_INT, false, null);
            $sectionnumber = $this->getParam('sectionnumber', PARAM_INT, false, null);
            $cmid = $this->getParam('cmid', PARAM_INT, false, null);
            $modname = $this->getParam('modname', PARAM_ALPHANUMEXT, false, null);
            $modid = $this->getParam('modid', PARAM_INT, false, null);

            // Build options array for Moodle function.
            $options = [];
            
            if ($excludemodules) {
                $options[] = ['name' => 'excludemodules', 'value' => true];
            }
            if ($excludecontents) {
                $options[] = ['name' => 'excludecontents', 'value' => true];
            }
            if ($sectionid !== null) {
                $options[] = ['name' => 'sectionid', 'value' => $sectionid];
            }
            if ($sectionnumber !== null) {
                $options[] = ['name' => 'sectionnumber', 'value' => $sectionnumber];
            }
            if ($cmid !== null) {
                $options[] = ['name' => 'cmid', 'value' => $cmid];
            }
            if ($modname !== null) {
                $options[] = ['name' => 'modname', 'value' => $modname];
            }
            if ($modid !== null) {
                $options[] = ['name' => 'modid', 'value' => $modid];
            }

            // Call existing Moodle external API function to get course contents.
            // This function handles:
            // - Permission checking for each module
            // - Retrieving section structure and metadata
            // - Getting all course modules and their properties
            // - Filtering based on visibility and availability
            // - Including file information and URLs
            // - Handling completion tracking data
            $contents = core_course_external::get_course_contents($courseid, $options);

            // The external function returns data that may need cleaning.
            // Use external_api::clean_returnvalue to ensure proper format.
            $contents = external_api::clean_returnvalue(
                core_course_external::get_course_contents_returns(),
                $contents
            );

            // Enhance the response with additional course information.
            $courseinfo = [
                'id' => $course->id,
                'fullname' => $course->fullname,
                'shortname' => $course->shortname,
                'format' => $course->format,
                'visible' => $course->visible,
                'startdate' => $course->startdate,
                'enddate' => $course->enddate,
            ];

            // Prepare response data.
            $responsedata = [
                'course' => $courseinfo,
                'sections' => $contents,
                'sectioncount' => count($contents),
            ];

            // Count total modules across all sections.
            $totalmodules = 0;
            foreach ($contents as $section) {
                if (isset($section['modules'])) {
                    $totalmodules += count($section['modules']);
                }
            }
            $responsedata['modulecount'] = $totalmodules;

            // Return standardized success response with course contents.
            $this->success($responsedata, 200);

        } catch (moodle_exception $e) {
            // Handle Moodle-specific exceptions.
            if (strpos($e->getMessage(), 'nopermission') !== false ||
                strpos($e->getMessage(), 'requireloginerror') !== false) {
                throw new ForbiddenException('You do not have permission to view this course content');
            } else if (strpos($e->getMessage(), 'invalidrecord') !== false ||
                       strpos($e->getMessage(), 'notfound') !== false) {
                throw new NotFoundException('Course not found');
            } else if (strpos($e->getMessage(), 'coursehidden') !== false) {
                throw new ForbiddenException('This course is not visible');
            } else if (strpos($e->getMessage(), 'notenrolled') !== false) {
                throw new ForbiddenException('You are not enrolled in this course');
            } else {
                // Generic server error for unexpected Moodle exceptions.
                throw new ServerException('Failed to retrieve course contents: ' . $e->getMessage());
            }
        } catch (invalid_parameter_exception $e) {
            // Handle parameter validation errors from external API.
            throw new ValidationException('Invalid parameters: ' . $e->getMessage());
        }
    }

    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for course contents retrieval');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for course contents retrieval');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for course contents retrieval');
    }
}

// Instantiate endpoint and execute request handling.

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new CoursesContentsEndpoint();
    $endpoint->execute();
}
