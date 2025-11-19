<?php
/**
 * API endpoint for retrieving detailed information about a specific course.
 *
 * This endpoint provides comprehensive course data including metadata, category,
 * format, enrollment options, visibility settings, course contacts (teachers),
 * enrollment statistics, course image, and completion information. It wraps 
 * existing Moodle core functions and enforces proper capability checks.
 *
 * Endpoint: GET /api/v1/courses/{id}
 * Query Parameters:
 *   - includecontacts (bool, optional): Include course contact (teacher) information
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "course": {
 *       "id": 5,
 *       "fullname": "Introduction to Programming",
 *       "shortname": "CS101",
 *       "category": 2,
 *       "categoryname": "Computer Science",
 *       "summary": "Learn programming fundamentals...",
 *       "summaryformat": 1,
 *       "format": "topics",
 *       "showgrades": 1,
 *       "newsitems": 5,
 *       "startdate": 1640995200,
 *       "enddate": 1672531200,
 *       "maxbytes": 52428800,
 *       "showreports": 1,
 *       "visible": 1,
 *       "groupmode": 0,
 *       "groupmodeforce": 0,
 *       "defaultgroupingid": 0,
 *       "enablecompletion": 1,
 *       "completionnotify": 0,
 *       "lang": "en",
 *       "theme": "",
 *       "marker": 0,
 *       "legacysortorder": 0,
 *       "enrollmentcount": 45,
 *       "courseimage": "https://example.com/pluginfile.php/...",
 *       "contacts": [
 *         {
 *           "userid": 3,
 *           "fullname": "John Doe",
 *           "role": "Teacher"
 *         }
 *       ],
 *       "completionenabled": true
 *     }
 *   }
 * }
 *
 * @package    api
 * @subpackage v1
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Require Moodle configuration and core libraries.
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/lib/enrollib.php');
require_once($CFG->dirroot . '/lib/filelib.php');
require_once($CFG->dirroot . '/lib/outputcomponents.php');

// Require API base class and exception classes.
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Course show endpoint class.
 *
 * Handles GET requests to retrieve detailed information about a specific course.
 * Enforces moodle/course:view capability and respects course visibility settings.
 * Provides comprehensive course data enriched with enrollment counts, course image,
 * teacher contacts, and completion status information.
 */
class CoursesShowEndpoint extends ApiBase {

    /**
     * Handle GET request to retrieve course details.
     *
     * This method performs the following operations:
     * 1. Validates JWT token and extracts authenticated user (inherited from ApiBase)
     * 2. Extracts and validates course ID parameter from URL path
     * 3. Retrieves course record from database using existing get_course() function
     * 4. Gets course context and enforces moodle/course:view capability check
     * 5. Retrieves additional course details including format-specific data
     * 6. Enriches course data with enrollment count, course image, contacts, and completion status
     * 7. Returns JSON response with standardized envelope format
     *
     * Supported Query Parameters:
     *   - includecontacts (bool): When true, includes course contact (teacher) information
     *
     * Error Responses:
     *   - 400 Bad Request: Invalid course ID format
     *   - 401 Unauthorized: Invalid or missing JWT token
     *   - 403 Forbidden: User lacks moodle/course:view permission
     *   - 404 Not Found: Course doesn't exist or user cannot view hidden course
     *   - 500 Internal Server Error: Unexpected server errors
     *
     * @return void Outputs JSON response and terminates
     * @throws ValidationException If course ID is invalid or missing
     * @throws UnauthorizedException If JWT token is invalid (handled by ApiBase)
     * @throws ForbiddenException If user lacks required permission
     * @throws NotFoundException If course doesn't exist or is not accessible
     * @throws ServerException For unexpected errors during processing
     */
    protected function handle_get() {
        global $DB, $CFG;

        try {
            // Get authenticated user from JWT token (validated by ApiBase constructor).
            $user = $this->getUser();

            // Extract and validate course ID from URL path parameter.
            // PARAM_INT ensures the ID is a valid integer and prevents SQL injection.
            $courseid = $this->getParam('id', PARAM_INT);

            // Validate course ID is positive integer.
            if (!$courseid || $courseid < 1) {
                throw new ValidationException('Invalid course ID. Must be a positive integer.');
            }

            // Retrieve course record from database using existing Moodle core function.
            // get_course() performs caching and will throw dml_missing_record_exception if not found.
            try {
                $course = get_course($courseid);
            } catch (dml_missing_record_exception $e) {
                throw new NotFoundException('Course with ID ' . $courseid . ' not found');
            } catch (Exception $e) {
                throw new ServerException('Failed to retrieve course: ' . $e->getMessage());
            }

            // Get course context for permission checking.
            // Context is required for all capability checks and enrollment queries.
            $coursecontext = context_course::instance($courseid);

            // Enforce permission check using ApiBase helper method.
            // This checks moodle/course:view capability at the course context level.
            // Throws ForbiddenException if user lacks permission.
            // Note: For hidden courses, this will fail unless user has viewhiddencourses capability.
            try {
                $this->checkCapability('moodle/course:view', $coursecontext);
            } catch (ForbiddenException $e) {
                // If course is hidden, provide more specific error message.
                if (!$course->visible) {
                    throw new NotFoundException('Course not found or not accessible');
                }
                throw $e;
            }

            // Extract optional query parameter for including course contacts (teachers).
            // Defaults to false to reduce response size when not needed.
            $includecontacts = $this->getParam('includecontacts', PARAM_BOOL, false, true);

            // Retrieve course category name for enriched response.
            $categoryname = '';
            if ($course->category > 0) {
                try {
                    $category = $DB->get_record('course_categories', ['id' => $course->category], 'name');
                    if ($category) {
                        $categoryname = $category->name;
                    }
                } catch (Exception $e) {
                    // Category retrieval failure is non-critical, continue without it.
                    $categoryname = '';
                }
            }

            // Retrieve format-specific course data using course format API.
            // This provides additional metadata specific to the course format (topics, weeks, etc.).
            $formatdata = [];
            try {
                $format = course_get_format($courseid);
                if ($format) {
                    // Get format-specific course data (e.g., number of sections, format options).
                    $formatoptions = $format->get_format_options();
                    if (!empty($formatoptions)) {
                        $formatdata = $formatoptions;
                    }
                }
            } catch (Exception $e) {
                // Format data retrieval failure is non-critical, continue without it.
                $formatdata = [];
            }

            // Count enrolled users in the course using existing Moodle function.
            // This provides statistics about course participation.
            $enrollmentcount = 0;
            try {
                $enrollmentcount = count_enrolled_users($coursecontext);
            } catch (Exception $e) {
                // Enrollment count failure is non-critical, default to 0.
                $enrollmentcount = 0;
            }

            // Retrieve course image URL if available.
            // Course images are stored in the course files area.
            $courseimageurl = '';
            try {
                // Use course_summary_exporter or direct file API to get course image.
                $course_obj = new core_course_list_element($course);
                $coursefiles = $course_obj->get_course_overviewfiles();
                
                if (!empty($coursefiles)) {
                    // Get the first image file.
                    foreach ($coursefiles as $file) {
                        if ($file->is_valid_image()) {
                            $courseimageurl = moodle_url::make_pluginfile_url(
                                $file->get_contextid(),
                                $file->get_component(),
                                $file->get_filearea(),
                                null,
                                $file->get_filepath(),
                                $file->get_filename()
                            )->out(false);
                            break;
                        }
                    }
                }
            } catch (Exception $e) {
                // Course image retrieval failure is non-critical, continue without it.
                $courseimageurl = '';
            }

            // Retrieve course completion status information.
            // This indicates if completion tracking is enabled and configured.
            $completionenabled = false;
            if ($course->enablecompletion) {
                // Completion is enabled at course level, check if criteria are defined.
                try {
                    require_once($CFG->dirroot . '/lib/completionlib.php');
                    $completion = new completion_info($course);
                    $completionenabled = $completion->is_enabled();
                } catch (Exception $e) {
                    // Completion check failure is non-critical.
                    $completionenabled = (bool)$course->enablecompletion;
                }
            }

            // Prepare comprehensive course data array with all required fields.
            // This includes all fields specified in the requirements document.
            $coursedata = [
                // Core identification fields.
                'id' => (int)$course->id,
                'fullname' => $course->fullname,
                'shortname' => $course->shortname,
                
                // Category information.
                'category' => (int)$course->category,
                'categoryname' => $categoryname,
                
                // Course content and description.
                'summary' => $course->summary,
                'summaryformat' => (int)$course->summaryformat,
                
                // Course format and structure.
                'format' => $course->format,
                'formatdata' => $formatdata,
                
                // Display and visibility settings.
                'showgrades' => (int)$course->showgrades,
                'newsitems' => (int)$course->newsitems,
                'showreports' => (int)$course->showreports,
                'visible' => (int)$course->visible,
                
                // Date settings.
                'startdate' => (int)$course->startdate,
                'enddate' => (int)$course->enddate,
                
                // File and size limits.
                'maxbytes' => (int)$course->maxbytes,
                
                // Group settings.
                'groupmode' => (int)$course->groupmode,
                'groupmodeforce' => (int)$course->groupmodeforce,
                'defaultgroupingid' => (int)$course->defaultgroupingid,
                
                // Completion tracking settings.
                'enablecompletion' => (int)$course->enablecompletion,
                'completionnotify' => (int)$course->completionnotify,
                'completionenabled' => $completionenabled,
                
                // Localization and theming.
                'lang' => $course->lang,
                'theme' => $course->theme,
                
                // Legacy and sorting fields.
                'marker' => (int)$course->marker,
                'legacysortorder' => (int)$course->legacysortorder,
                
                // Enriched data fields.
                'enrollmentcount' => $enrollmentcount,
                'courseimage' => $courseimageurl,
            ];

            // Include course contacts (teachers) if requested via query parameter.
            // This provides information about course instructors/teachers.
            if ($includecontacts) {
                $coursecontacts = [];
                try {
                    // Get course contacts using core_course_list_element method.
                    // Course contacts are typically teachers with specific roles.
                    $contacts = $course_obj->get_course_contacts();
                    
                    if (!empty($contacts)) {
                        foreach ($contacts as $contact) {
                            // Extract user and role information.
                            $contactdata = [
                                'userid' => (int)$contact['user']->id,
                                'fullname' => fullname($contact['user']),
                                'email' => $contact['user']->email,
                                'roles' => []
                            ];
                            
                            // Add role names for this contact.
                            if (!empty($contact['roles'])) {
                                foreach ($contact['roles'] as $role) {
                                    $contactdata['roles'][] = $role->displayname;
                                }
                            }
                            
                            $coursecontacts[] = $contactdata;
                        }
                    }
                } catch (Exception $e) {
                    // Course contacts retrieval failure is non-critical.
                    $coursecontacts = [];
                }
                
                $coursedata['contacts'] = $coursecontacts;
            }

            // Prepare final response data with standardized envelope.
            // The 'course' key contains all course information.
            $responsedata = [
                'course' => $coursedata
            ];

            // Return standardized success response with HTTP 200 status.
            // ApiBase::success() method formats response with {"success": true, "data": {...}} envelope.
            $this->success($responsedata, 200);

        } catch (ValidationException $e) {
            // Re-throw validation exceptions with HTTP 400 status.
            throw $e;
        } catch (NotFoundException $e) {
            // Re-throw not found exceptions with HTTP 404 status.
            throw $e;
        } catch (ForbiddenException $e) {
            // Re-throw forbidden exceptions with HTTP 403 status.
            throw $e;
        } catch (moodle_exception $e) {
            // Handle Moodle-specific exceptions and map to appropriate API exceptions.
            $message = $e->getMessage();
            
            // Check for permission-related Moodle exceptions.
            if (strpos($message, 'nopermission') !== false || 
                strpos($message, 'nopermissions') !== false ||
                strpos($message, 'accessdenied') !== false) {
                throw new ForbiddenException('You do not have permission to view this course');
            }
            
            // Check for not found related Moodle exceptions.
            if (strpos($message, 'invalidrecord') !== false ||
                strpos($message, 'notfound') !== false ||
                strpos($message, 'invalidcourseid') !== false) {
                throw new NotFoundException('Course not found');
            }
            
            // Generic server error for unexpected Moodle exceptions.
            // Include original error message for debugging while in development.
            throw new ServerException('Failed to retrieve course details: ' . $message);
            
        } catch (Exception $e) {
            // Catch any other unexpected exceptions and return generic server error.
            // Log the full exception for debugging purposes.
            error_log('API Error in CoursesShowEndpoint: ' . $e->getMessage());
            error_log('Stack trace: ' . $e->getTraceAsString());
            
            throw new ServerException('An unexpected error occurred while retrieving course details');
        }
    }

    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * Course detail retrieval is read-only and only supports GET requests.
     * Course creation is handled by a separate endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown with HTTP 405 status
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for course detail retrieval');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * Course detail retrieval is read-only and only supports GET requests.
     * Course updates are handled by a separate endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown with HTTP 405 status
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for course detail retrieval');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * Course detail retrieval is read-only and only supports GET requests.
     * Course deletion is handled by a separate endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown with HTTP 405 status
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for course detail retrieval');
    }
}

// Instantiate endpoint and execute request handling.
// The endpoint is only executed when not in test mode to allow for unit testing.
if (!defined('API_TEST_MODE')) {
    $endpoint = new CoursesShowEndpoint();
    $endpoint->execute();
}
