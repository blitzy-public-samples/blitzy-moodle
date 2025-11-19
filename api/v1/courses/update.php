<?php
/**
 * Course Update API Endpoint
 *
 * PUT /api/v1/courses/{id} - Update an existing course
 *
 * This endpoint provides the ability to update existing courses in the system.
 * It wraps the existing Moodle course update functionality without
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
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Course Update Endpoint Handler
 *
 * Handles PUT requests to update an existing course.
 * Delegates all business logic to existing Moodle core functions:
 * - update_course() for course modification with full validation
 * - core_course_external::update_courses() for external API access
 *
 * URL Parameters:
 * - id: Course ID (required, from URL path)
 *
 * Optional PUT Parameters:
 * - fullname: Full name of the course
 * - shortname: Short name/code for the course
 * - categoryid: Course category ID
 * - summary: Course description/summary
 * - summaryformat: Format of summary (1=HTML, 0=MOODLE, 2=PLAIN, 4=MARKDOWN)
 * - format: Course format (topics, weeks, social, etc.)
 * - startdate: Course start date (Unix timestamp)
 * - enddate: Course end date (Unix timestamp)
 * - visible: Course visibility (1=visible, 0=hidden)
 * - lang: Course language
 * - enablecompletion: Enable completion tracking (1=yes, 0=no)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "fullname": "Updated Course",
 *     ...
 *   }
 * }
 */
class CoursesUpdateEndpoint extends ApiBase {
    
    /**
     * Handle PUT requests to update an existing course.
     *
     * This method:
     * 1. Validates JWT token and extracts authenticated user
     * 2. Extracts and validates course ID from URL path
     * 3. Verifies course exists and user has permission to update it
     * 4. Extracts and validates course data from PUT body
     * 5. Calls existing Moodle update_course() function
     * 6. Returns standardized JSON response with updated course data
     *
     * @return void Outputs JSON response and exits
     * @throws ApiException If validation fails or user lacks permissions
     */
    protected function handle_put() {
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
                $existingcourse = get_course($courseid);
            } catch (dml_missing_record_exception $e) {
                throw new NotFoundException('Course not found');
            }

            // Check if user has permission to update the course.
            $coursecontext = context_course::instance($courseid);
            $this->checkCapability('moodle/course:update', $coursecontext);

            // Extract optional parameters from PUT body.
            // Only include parameters that are actually provided.
            $fullname = $this->getParam('fullname', PARAM_TEXT, false, null);
            $shortname = $this->getParam('shortname', PARAM_TEXT, false, null);
            $categoryid = $this->getParam('categoryid', PARAM_INT, false, null);
            $summary = $this->getParam('summary', PARAM_RAW, false, null);
            $summaryformat = $this->getParam('summaryformat', PARAM_INT, false, null);
            $format = $this->getParam('format', PARAM_ALPHA, false, null);
            $startdate = $this->getParam('startdate', PARAM_INT, false, null);
            $enddate = $this->getParam('enddate', PARAM_INT, false, null);
            $visible = $this->getParam('visible', PARAM_INT, false, null);
            $lang = $this->getParam('lang', PARAM_ALPHANUMEXT, false, null);
            $enablecompletion = $this->getParam('enablecompletion', PARAM_INT, false, null);

            // Build course data object starting with existing course.
            $coursedata = new stdClass();
            $coursedata->id = $courseid;

            // Update only provided fields.
            if ($fullname !== null) {
                if (empty(trim($fullname))) {
                    throw new ValidationException('Course full name cannot be empty');
                }
                $coursedata->fullname = $fullname;
            }

            if ($shortname !== null) {
                if (empty(trim($shortname))) {
                    throw new ValidationException('Course short name cannot be empty');
                }
                // Check if shortname is already in use by a different course.
                $existing = $DB->get_record('course', ['shortname' => $shortname]);
                if ($existing && $existing->id != $courseid) {
                    throw new ValidationException('Course with this short name already exists');
                }
                $coursedata->shortname = $shortname;
            }

            if ($categoryid !== null) {
                if ($categoryid <= 0) {
                    throw new ValidationException('Invalid category ID');
                }
                // Verify the category exists.
                if (!$DB->record_exists('course_categories', ['id' => $categoryid])) {
                    throw new ValidationException('Course category not found');
                }
                $coursedata->category = $categoryid;
            }

            if ($summary !== null) {
                $coursedata->summary = $summary;
            }

            if ($summaryformat !== null) {
                if (!in_array($summaryformat, [FORMAT_HTML, FORMAT_MOODLE, FORMAT_PLAIN, FORMAT_MARKDOWN], true)) {
                    throw new ValidationException('Invalid summary format');
                }
                $coursedata->summaryformat = $summaryformat;
            }

            if ($format !== null) {
                // Validate course format.
                $courseformats = get_plugin_list('format');
                if (!array_key_exists($format, $courseformats)) {
                    throw new ValidationException('Invalid course format');
                }
                $coursedata->format = $format;
            }

            if ($startdate !== null) {
                $coursedata->startdate = $startdate;
            }

            if ($enddate !== null) {
                // Validate end date if both start and end are being set.
                $finalstartdate = isset($coursedata->startdate) ? $coursedata->startdate : $existingcourse->startdate;
                if ($enddate > 0 && $enddate < $finalstartdate) {
                    throw new ValidationException('End date cannot be before start date');
                }
                $coursedata->enddate = $enddate;
            }

            if ($visible !== null) {
                if (!in_array($visible, [0, 1], true)) {
                    throw new ValidationException('Visible must be 0 or 1');
                }
                $coursedata->visible = $visible;
            }

            if ($lang !== null) {
                $coursedata->lang = $lang;
            }

            if ($enablecompletion !== null) {
                if (!in_array($enablecompletion, [0, 1], true)) {
                    throw new ValidationException('Enable completion must be 0 or 1');
                }
                $coursedata->enablecompletion = $enablecompletion;
            }

            // Call existing Moodle function to update the course.
            // This function handles all validation, database operations, events, and caching.
            update_course($coursedata);

            // Retrieve the updated course to return complete data.
            $updatedcourse = get_course($courseid);

            // Prepare response data.
            $responsedata = [
                'id' => $updatedcourse->id,
                'fullname' => $updatedcourse->fullname,
                'shortname' => $updatedcourse->shortname,
                'categoryid' => $updatedcourse->category,
                'summary' => $updatedcourse->summary,
                'summaryformat' => $updatedcourse->summaryformat,
                'format' => $updatedcourse->format,
                'startdate' => $updatedcourse->startdate,
                'enddate' => $updatedcourse->enddate,
                'visible' => $updatedcourse->visible,
                'lang' => $updatedcourse->lang,
                'enablecompletion' => $updatedcourse->enablecompletion,
            ];

            // Return standardized success response with updated course data.
            $this->success($responsedata, 200);

        } catch (moodle_exception $e) {
            // Handle Moodle-specific exceptions.
            if (strpos($e->getMessage(), 'nopermission') !== false) {
                throw new ForbiddenException('You do not have permission to update this course');
            } else if (strpos($e->getMessage(), 'invalidrecord') !== false ||
                       strpos($e->getMessage(), 'notfound') !== false) {
                throw new NotFoundException('Course not found');
            } else if (strpos($e->getMessage(), 'shortnametaken') !== false) {
                throw new ValidationException('Course with this short name already exists');
            } else if (strpos($e->getMessage(), 'invaliddata') !== false) {
                throw new ValidationException('Invalid course data: ' . $e->getMessage());
            } else {
                // Generic server error for unexpected Moodle exceptions.
                throw new ServerException('Failed to update course: ' . $e->getMessage());
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
        throw new MethodNotAllowedException('GET method not supported for course update');
    }

    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for course update');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for course update');
    }
}

// Instantiate endpoint and execute request handling.

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new CoursesUpdateEndpoint();
    $endpoint->execute();
}
