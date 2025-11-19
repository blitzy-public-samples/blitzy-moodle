<?php
/**
 * Course Creation API Endpoint
 *
 * POST /api/v1/courses - Create a new course
 *
 * This endpoint provides the ability to create new courses in the system.
 * It wraps the existing Moodle course creation functionality without
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
 * Course Create Endpoint Handler
 *
 * Handles POST requests to create a new course.
 * Delegates all business logic to existing Moodle core functions:
 * - create_course() for course creation with full validation
 * - core_course_external::create_courses() for external API access
 *
 * Required POST Parameters:
 * - fullname: Full name of the course
 * - shortname: Short name/code for the course (must be unique)
 * - categoryid: Course category ID
 *
 * Optional POST Parameters:
 * - summary: Course description/summary
 * - summaryformat: Format of summary (1=HTML, 0=MOODLE, 2=PLAIN, 4=MARKDOWN)
 * - format: Course format (topics, weeks, social, etc.) (default: topics)
 * - startdate: Course start date (Unix timestamp)
 * - enddate: Course end date (Unix timestamp)
 * - visible: Course visibility (1=visible, 0=hidden) (default: 1)
 * - lang: Course language
 * - enablecompletion: Enable completion tracking (1=yes, 0=no)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "fullname": "New Course",
 *     "shortname": "NEW101",
 *     ...
 *   }
 * }
 */
class CoursesCreateEndpoint extends ApiBase {
    
    /**
     * Handle POST requests to create a new course.
     *
     * This method:
     * 1. Validates JWT token and extracts authenticated user
     * 2. Checks user has permission to create courses
     * 3. Extracts and validates course data from POST body
     * 4. Calls existing Moodle create_course() function
     * 5. Returns standardized JSON response with created course data
     *
     * @return void Outputs JSON response and exits
     * @throws ApiException If validation fails or user lacks permissions
     */
    protected function handle_post() {
        global $CFG, $DB;

        try {
            // Get authenticated user from JWT token.
            $user = $this->getUser();
            if (!$user) {
                throw new UnauthorizedException('Authentication required');
            }

            // Check if user has permission to create courses.
            // This requires the moodle/course:create capability at system or category level.
            $systemcontext = context_system::instance();
            $this->checkCapability('moodle/course:create', $systemcontext);

            // Extract required parameters from POST body.
            $fullname = $this->getParam('fullname', PARAM_TEXT, true);
            $shortname = $this->getParam('shortname', PARAM_TEXT, true);
            $categoryid = $this->getParam('categoryid', PARAM_INT, true);

            // Validate required parameters.
            if (empty(trim($fullname))) {
                throw new ValidationException('Course full name is required and cannot be empty');
            }
            if (empty(trim($shortname))) {
                throw new ValidationException('Course short name is required and cannot be empty');
            }
            if ($categoryid <= 0) {
                throw new ValidationException('Invalid category ID');
            }

            // Verify the category exists.
            if (!$DB->record_exists('course_categories', ['id' => $categoryid])) {
                throw new ValidationException('Course category not found');
            }

            // Check if shortname is already in use.
            if ($DB->record_exists('course', ['shortname' => $shortname])) {
                throw new ValidationException('Course with this short name already exists');
            }

            // Extract optional parameters with defaults.
            $summary = $this->getParam('summary', PARAM_RAW, false, '');
            $summaryformat = $this->getParam('summaryformat', PARAM_INT, false, FORMAT_HTML);
            $format = $this->getParam('format', PARAM_ALPHA, false, 'topics');
            $startdate = $this->getParam('startdate', PARAM_INT, false, time());
            $enddate = $this->getParam('enddate', PARAM_INT, false, 0);
            $visible = $this->getParam('visible', PARAM_INT, false, 1);
            $lang = $this->getParam('lang', PARAM_ALPHANUMEXT, false, '');
            $enablecompletion = $this->getParam('enablecompletion', PARAM_INT, false, 0);

            // Validate optional parameters.
            if (!in_array($summaryformat, [FORMAT_HTML, FORMAT_MOODLE, FORMAT_PLAIN, FORMAT_MARKDOWN], true)) {
                throw new ValidationException('Invalid summary format');
            }
            if (!in_array($visible, [0, 1], true)) {
                throw new ValidationException('Visible must be 0 or 1');
            }
            if (!in_array($enablecompletion, [0, 1], true)) {
                throw new ValidationException('Enable completion must be 0 or 1');
            }
            if ($enddate > 0 && $enddate < $startdate) {
                throw new ValidationException('End date cannot be before start date');
            }

            // Validate course format.
            $courseformats = get_plugin_list('format');
            if (!array_key_exists($format, $courseformats)) {
                throw new ValidationException('Invalid course format');
            }

            // Build course data object for create_course().
            $coursedata = new stdClass();
            $coursedata->fullname = $fullname;
            $coursedata->shortname = $shortname;
            $coursedata->category = $categoryid;
            $coursedata->summary = $summary;
            $coursedata->summaryformat = $summaryformat;
            $coursedata->format = $format;
            $coursedata->startdate = $startdate;
            $coursedata->enddate = $enddate;
            $coursedata->visible = $visible;
            $coursedata->lang = $lang;
            $coursedata->enablecompletion = $enablecompletion;

            // Call existing Moodle function to create the course.
            // This function handles all validation, database operations, events, and caching.
            $newcourse = create_course($coursedata);

            // Prepare response data.
            $responsedata = [
                'id' => $newcourse->id,
                'fullname' => $newcourse->fullname,
                'shortname' => $newcourse->shortname,
                'categoryid' => $newcourse->category,
                'summary' => $newcourse->summary,
                'summaryformat' => $newcourse->summaryformat,
                'format' => $newcourse->format,
                'startdate' => $newcourse->startdate,
                'enddate' => $newcourse->enddate,
                'visible' => $newcourse->visible,
                'lang' => $newcourse->lang,
                'enablecompletion' => $newcourse->enablecompletion,
            ];

            // Return standardized success response with created course data.
            // HTTP 201 Created status code for resource creation.
            $this->success($responsedata, 201);

        } catch (moodle_exception $e) {
            // Handle Moodle-specific exceptions.
            if (strpos($e->getMessage(), 'nopermission') !== false) {
                throw new ForbiddenException('You do not have permission to create courses');
            } else if (strpos($e->getMessage(), 'shortnametaken') !== false) {
                throw new ValidationException('Course with this short name already exists');
            } else if (strpos($e->getMessage(), 'invaliddata') !== false) {
                throw new ValidationException('Invalid course data: ' . $e->getMessage());
            } else {
                // Generic server error for unexpected Moodle exceptions.
                throw new ServerException('Failed to create course: ' . $e->getMessage());
            }
        }
    }

    /**
     * Handle GET requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for course creation');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for course creation');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for course creation');
    }
}

// Instantiate endpoint and execute request handling.

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new CoursesCreateEndpoint();
    $endpoint->execute();
}
