<?php
/**
 * Course Creation API Endpoint
 *
 * POST /api/v1/courses - Create a new course
 *
 * This endpoint provides the ability to create new courses in the system.
 * It wraps the existing Moodle course creation functionality without
 * duplicating any business logic. All validation, permission checks, and
 * database operations are delegated to existing Moodle core functions.
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
require_once($CFG->dirroot . '/enrol/locallib.php');
require_once($CFG->apiroot . '/lib/api_base.php');
require_once($CFG->apiroot . '/lib/api_exception.php');

/**
 * Course Create Endpoint Handler
 *
 * Handles POST requests to create a new course in the system.
 * All business logic is delegated to existing Moodle core functions:
 * - create_course() for course creation with full validation
 * - enrol_try_internal_enrol() for optional creator enrollment
 *
 * Required JSON Body Fields:
 * - fullname: Full name of the course (non-empty string)
 * - shortname: Short name/code for the course (unique, non-empty string)
 * - category: Course category ID (valid existing category)
 *
 * Optional JSON Body Fields:
 * - summary: Course description (default: empty string)
 * - summaryformat: Summary format (FORMAT_HTML=1, FORMAT_MOODLE=0, FORMAT_PLAIN=2, FORMAT_MARKDOWN=4, default: FORMAT_HTML)
 * - format: Course format ('topics', 'weeks', 'social', etc., default: 'topics')
 * - visible: Course visibility (1=visible, 0=hidden, default: 1)
 * - startdate: Course start date (Unix timestamp, default: current time)
 * - enddate: Course end date (Unix timestamp, optional, must be >= startdate)
 * - maxbytes: Maximum file upload size in bytes (default: from site settings)
 * - showgrades: Show grades to students (1=yes, 0=no, default: 1)
 * - showreports: Show activity reports (1=yes, 0=no, default: 0)
 * - newsitems: Number of recent news items (default: 5)
 * - groupmode: Group mode (NOGROUPS=0, SEPARATEGROUPS=1, VISIBLEGROUPS=2, default: NOGROUPS)
 * - groupmodeforce: Force group mode (1=yes, 0=no, default: 0)
 * - defaultgroupingid: Default grouping ID (default: 0)
 * - enablecompletion: Enable completion tracking (1=yes, 0=no, default: 0)
 * - completionnotify: Notify on completion (1=yes, 0=no, default: 0)
 * - lang: Course language code (must be installed, default: empty for site default)
 * - theme: Course theme name (must be enabled, default: empty for site default)
 * - idnumber: Course ID number (optional, must be unique)
 *
 * Response Format (HTTP 201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "course": {
 *       "id": 123,
 *       "fullname": "Introduction to Programming",
 *       "shortname": "CS101",
 *       "category": 5,
 *       "summary": "Learn programming basics",
 *       "format": "topics",
 *       ...
 *     }
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Validation failures (missing required fields, invalid formats, field constraints)
 * - 401 Unauthorized: No JWT token or invalid token
 * - 403 Forbidden: User lacks moodle/course:create capability at system or category level
 * - 404 Not Found: Category does not exist, invalid course format, or invalid theme/language
 * - 409 Conflict: Shortname or idnumber already exists
 * - 500 Internal Server Error: Unexpected server errors during course creation
 */
class CourseCreateEndpoint extends ApiBase {
    
    /**
     * Handle GET requests - not allowed for course creation.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not allowed for course creation. Use POST to create courses.');
    }
    
    /**
     * Handle POST requests to create a new course.
     *
     * Implementation Steps:
     * 1. Validate JWT token and extract authenticated user
     * 2. Parse JSON request body to get course creation fields
     * 3. Check user has moodle/course:create capability at system level
     * 4. Validate all required fields (fullname, shortname, category)
     * 5. Verify category exists and check capability in category context
     * 6. Validate optional fields and apply defaults
     * 7. Check shortname and idnumber uniqueness
     * 8. Call existing create_course() function (delegates all business logic)
     * 9. Optionally enroll creator as teacher if configured
     * 10. Return standardized JSON response with HTTP 201 Created status
     *
     * @return void Outputs JSON response and exits
     * @throws UnauthorizedException If JWT token is missing or invalid
     * @throws ForbiddenException If user lacks required capabilities
     * @throws ValidationException If field validation fails
     * @throws NotFoundException If category, format, theme, or language not found
     * @throws ConflictException If shortname or idnumber already exists
     * @throws ServerException For unexpected errors during course creation
     */
    protected function handle_post() {
        global $CFG, $DB;

        try {
            // Step 1: Validate JWT token and get authenticated user
            $user = $this->getUser();
            if (!$user) {
                throw new UnauthorizedException('Authentication required');
            }

            // Step 2: Parse JSON request body
            $jsonbody = $this->getJsonBody();
            
            // Step 3: Check system-level capability for course creation
            $systemcontext = context_system::instance();
            $this->checkCapability('moodle/course:create', $systemcontext);

            // Step 4: Extract and validate required fields
            
            // Validate fullname (required, non-empty)
            if (!isset($jsonbody['fullname'])) {
                throw new ValidationException('Missing required field: fullname', [
                    'field' => 'fullname',
                    'reason' => 'Full name of the course is required'
                ]);
            }
            $fullname = clean_param($jsonbody['fullname'], PARAM_TEXT);
            if (empty(trim($fullname))) {
                throw new ValidationException('Course full name cannot be empty', [
                    'field' => 'fullname',
                    'value' => $jsonbody['fullname']
                ]);
            }

            // Validate shortname (required, non-empty, unique)
            if (!isset($jsonbody['shortname'])) {
                throw new ValidationException('Missing required field: shortname', [
                    'field' => 'shortname',
                    'reason' => 'Short name/code for the course is required'
                ]);
            }
            $shortname = clean_param($jsonbody['shortname'], PARAM_TEXT);
            if (empty(trim($shortname))) {
                throw new ValidationException('Course short name cannot be empty', [
                    'field' => 'shortname',
                    'value' => $jsonbody['shortname']
                ]);
            }

            // Validate category (required, valid ID)
            if (!isset($jsonbody['category'])) {
                throw new ValidationException('Missing required field: category', [
                    'field' => 'category',
                    'reason' => 'Course category ID is required'
                ]);
            }
            $categoryid = clean_param($jsonbody['category'], PARAM_INT);
            if ($categoryid <= 0) {
                throw new ValidationException('Invalid category ID', [
                    'field' => 'category',
                    'value' => $jsonbody['category'],
                    'reason' => 'Category ID must be a positive integer'
                ]);
            }

            // Step 5: Verify category exists
            $category = $DB->get_record('course_categories', ['id' => $categoryid]);
            if (!$category) {
                throw new NotFoundException('Course category not found', [
                    'categoryId' => $categoryid,
                    'reason' => 'The specified category does not exist'
                ]);
            }

            // Check capability in category context
            $categorycontext = context_coursecat::instance($categoryid);
            $this->checkCapability('moodle/course:create', $categorycontext);

            // Step 6: Check shortname uniqueness
            if ($DB->record_exists('course', ['shortname' => $shortname])) {
                throw new ConflictException('Course with this short name already exists', [
                    'field' => 'shortname',
                    'value' => $shortname,
                    'reason' => 'Short name must be unique across all courses'
                ]);
            }

            // Step 7: Extract and validate optional fields with defaults
            
            // Summary (course description) - optional, defaults to empty
            $summary = '';
            if (isset($jsonbody['summary'])) {
                $summary = clean_param($jsonbody['summary'], PARAM_RAW);
            }

            // Summary format - defaults to FORMAT_HTML
            $summaryformat = FORMAT_HTML;
            if (isset($jsonbody['summaryformat'])) {
                $summaryformat = clean_param($jsonbody['summaryformat'], PARAM_INT);
                if (!in_array($summaryformat, [FORMAT_HTML, FORMAT_MOODLE, FORMAT_PLAIN, FORMAT_MARKDOWN], true)) {
                    throw new ValidationException('Invalid summary format', [
                        'field' => 'summaryformat',
                        'value' => $jsonbody['summaryformat'],
                        'allowed' => [FORMAT_HTML, FORMAT_MOODLE, FORMAT_PLAIN, FORMAT_MARKDOWN]
                    ]);
                }
            }

            // Course format - defaults to 'topics'
            $format = 'topics';
            if (isset($jsonbody['format'])) {
                $format = clean_param($jsonbody['format'], PARAM_ALPHANUMEXT);
                // Validate format is installed
                $courseformats = get_plugin_list('format');
                if (!array_key_exists($format, $courseformats)) {
                    throw new ValidationException('Invalid course format', [
                        'field' => 'format',
                        'value' => $format,
                        'reason' => 'Course format is not installed',
                        'available' => array_keys($courseformats)
                    ]);
                }
            }

            // Visible - defaults to 1 (visible)
            $visible = 1;
            if (isset($jsonbody['visible'])) {
                $visible = clean_param($jsonbody['visible'], PARAM_INT);
                if (!in_array($visible, [0, 1], true)) {
                    throw new ValidationException('Visible must be 0 or 1', [
                        'field' => 'visible',
                        'value' => $jsonbody['visible']
                    ]);
                }
            }

            // Start date - defaults to current time
            $startdate = time();
            if (isset($jsonbody['startdate'])) {
                $startdate = clean_param($jsonbody['startdate'], PARAM_INT);
                if ($startdate < 0) {
                    throw new ValidationException('Start date must be a valid timestamp', [
                        'field' => 'startdate',
                        'value' => $jsonbody['startdate']
                    ]);
                }
            }

            // End date - optional, must be >= startdate
            $enddate = 0;
            if (isset($jsonbody['enddate'])) {
                $enddate = clean_param($jsonbody['enddate'], PARAM_INT);
                if ($enddate < 0) {
                    throw new ValidationException('End date must be a valid timestamp', [
                        'field' => 'enddate',
                        'value' => $jsonbody['enddate']
                    ]);
                }
                if ($enddate > 0 && $enddate < $startdate) {
                    throw new ValidationException('End date cannot be before start date', [
                        'field' => 'enddate',
                        'value' => $enddate,
                        'startdate' => $startdate
                    ]);
                }
            }

            // Maximum file upload size - defaults to site settings
            $maxbytes = 0; // 0 means use site default
            if (isset($jsonbody['maxbytes'])) {
                $maxbytes = clean_param($jsonbody['maxbytes'], PARAM_INT);
                // Validate maxbytes is within allowed limits
                if ($maxbytes < 0) {
                    throw new ValidationException('Max bytes must be non-negative', [
                        'field' => 'maxbytes',
                        'value' => $jsonbody['maxbytes']
                    ]);
                }
                // Check against site limit if configured
                if (isset($CFG->maxbytes) && $CFG->maxbytes > 0 && $maxbytes > $CFG->maxbytes) {
                    throw new ValidationException('Max bytes exceeds site limit', [
                        'field' => 'maxbytes',
                        'value' => $maxbytes,
                        'siteLimit' => $CFG->maxbytes
                    ]);
                }
            }

            // Show grades - defaults to 1
            $showgrades = 1;
            if (isset($jsonbody['showgrades'])) {
                $showgrades = clean_param($jsonbody['showgrades'], PARAM_INT);
                if (!in_array($showgrades, [0, 1], true)) {
                    throw new ValidationException('Show grades must be 0 or 1', [
                        'field' => 'showgrades',
                        'value' => $jsonbody['showgrades']
                    ]);
                }
            }

            // Show reports - defaults to 0
            $showreports = 0;
            if (isset($jsonbody['showreports'])) {
                $showreports = clean_param($jsonbody['showreports'], PARAM_INT);
                if (!in_array($showreports, [0, 1], true)) {
                    throw new ValidationException('Show reports must be 0 or 1', [
                        'field' => 'showreports',
                        'value' => $jsonbody['showreports']
                    ]);
                }
            }

            // News items (announcements) - defaults to 5
            $newsitems = 5;
            if (isset($jsonbody['newsitems'])) {
                $newsitems = clean_param($jsonbody['newsitems'], PARAM_INT);
                if ($newsitems < 0) {
                    throw new ValidationException('News items must be non-negative', [
                        'field' => 'newsitems',
                        'value' => $jsonbody['newsitems']
                    ]);
                }
            }

            // Group mode - defaults to NOGROUPS (0)
            $groupmode = NOGROUPS;
            if (isset($jsonbody['groupmode'])) {
                $groupmode = clean_param($jsonbody['groupmode'], PARAM_INT);
                if (!in_array($groupmode, [NOGROUPS, SEPARATEGROUPS, VISIBLEGROUPS], true)) {
                    throw new ValidationException('Invalid group mode', [
                        'field' => 'groupmode',
                        'value' => $jsonbody['groupmode'],
                        'allowed' => [NOGROUPS, SEPARATEGROUPS, VISIBLEGROUPS]
                    ]);
                }
            }

            // Group mode force - defaults to 0
            $groupmodeforce = 0;
            if (isset($jsonbody['groupmodeforce'])) {
                $groupmodeforce = clean_param($jsonbody['groupmodeforce'], PARAM_INT);
                if (!in_array($groupmodeforce, [0, 1], true)) {
                    throw new ValidationException('Group mode force must be 0 or 1', [
                        'field' => 'groupmodeforce',
                        'value' => $jsonbody['groupmodeforce']
                    ]);
                }
            }

            // Default grouping ID - defaults to 0
            $defaultgroupingid = 0;
            if (isset($jsonbody['defaultgroupingid'])) {
                $defaultgroupingid = clean_param($jsonbody['defaultgroupingid'], PARAM_INT);
                if ($defaultgroupingid < 0) {
                    throw new ValidationException('Default grouping ID must be non-negative', [
                        'field' => 'defaultgroupingid',
                        'value' => $jsonbody['defaultgroupingid']
                    ]);
                }
            }

            // Enable completion - defaults to 0
            $enablecompletion = 0;
            if (isset($jsonbody['enablecompletion'])) {
                $enablecompletion = clean_param($jsonbody['enablecompletion'], PARAM_INT);
                if (!in_array($enablecompletion, [0, 1], true)) {
                    throw new ValidationException('Enable completion must be 0 or 1', [
                        'field' => 'enablecompletion',
                        'value' => $jsonbody['enablecompletion']
                    ]);
                }
            }

            // Completion notify - defaults to 0
            $completionnotify = 0;
            if (isset($jsonbody['completionnotify'])) {
                $completionnotify = clean_param($jsonbody['completionnotify'], PARAM_INT);
                if (!in_array($completionnotify, [0, 1], true)) {
                    throw new ValidationException('Completion notify must be 0 or 1', [
                        'field' => 'completionnotify',
                        'value' => $jsonbody['completionnotify']
                    ]);
                }
            }

            // Language - defaults to empty (site default)
            $lang = '';
            if (isset($jsonbody['lang'])) {
                $lang = clean_param($jsonbody['lang'], PARAM_ALPHANUMEXT);
                if (!empty($lang)) {
                    // Validate language is installed
                    $installedlangs = get_string_manager()->get_list_of_translations();
                    if (!array_key_exists($lang, $installedlangs)) {
                        throw new ValidationException('Language not installed', [
                            'field' => 'lang',
                            'value' => $lang,
                            'reason' => 'Language pack is not installed',
                            'available' => array_keys($installedlangs)
                        ]);
                    }
                }
            }

            // Theme - defaults to empty (site default)
            $theme = '';
            if (isset($jsonbody['theme'])) {
                $theme = clean_param($jsonbody['theme'], PARAM_ALPHANUMEXT);
                if (!empty($theme)) {
                    // Validate theme is installed and enabled
                    $installedthemes = get_plugin_list('theme');
                    if (!array_key_exists($theme, $installedthemes)) {
                        throw new ValidationException('Theme not installed', [
                            'field' => 'theme',
                            'value' => $theme,
                            'reason' => 'Theme is not installed',
                            'available' => array_keys($installedthemes)
                        ]);
                    }
                }
            }

            // ID number - optional, must be unique if provided
            $idnumber = '';
            if (isset($jsonbody['idnumber'])) {
                $idnumber = clean_param($jsonbody['idnumber'], PARAM_RAW);
                if (!empty($idnumber)) {
                    // Check idnumber uniqueness
                    if ($DB->record_exists('course', ['idnumber' => $idnumber])) {
                        throw new ConflictException('Course with this ID number already exists', [
                            'field' => 'idnumber',
                            'value' => $idnumber,
                            'reason' => 'ID number must be unique across all courses'
                        ]);
                    }
                }
            }

            // Step 8: Build course data object for create_course()
            // All fields are validated and sanitized at this point
            $coursedata = new stdClass();
            
            // Required fields
            $coursedata->fullname = $fullname;
            $coursedata->shortname = $shortname;
            $coursedata->category = $categoryid;
            
            // Optional fields with defaults
            $coursedata->summary = $summary;
            $coursedata->summaryformat = $summaryformat;
            $coursedata->format = $format;
            $coursedata->visible = $visible;
            $coursedata->startdate = $startdate;
            $coursedata->enddate = $enddate;
            $coursedata->maxbytes = $maxbytes;
            $coursedata->showgrades = $showgrades;
            $coursedata->showreports = $showreports;
            $coursedata->newsitems = $newsitems;
            $coursedata->groupmode = $groupmode;
            $coursedata->groupmodeforce = $groupmodeforce;
            $coursedata->defaultgroupingid = $defaultgroupingid;
            $coursedata->enablecompletion = $enablecompletion;
            $coursedata->completionnotify = $completionnotify;
            $coursedata->lang = $lang;
            $coursedata->theme = $theme;
            $coursedata->idnumber = $idnumber;
            
            // System-managed fields (create_course() will set these if not provided)
            $coursedata->timecreated = time();
            $coursedata->timemodified = time();
            $coursedata->requested = 0; // Not a course request
            $coursedata->cacherev = time();

            // Step 9: Call existing create_course() function
            // This function handles:
            // - Final validation of all fields
            // - Insertion into mdl_course table
            // - Creation of course context
            // - Initialization of course format with default sections
            // - Enrollment of creator as teacher (if configured)
            // - Creation of default grade categories
            // - Triggering of course_created event
            // - Cache invalidation
            require_once($CFG->dirroot . '/course/lib.php');
            
            $newcourse = create_course($coursedata);
            
            // Step 10: Optionally enroll creator as teacher
            // Check if system is configured to enroll creators with a specific role
            if (!empty($CFG->creatornewroleid)) {
                $coursecontext = context_course::instance($newcourse->id);
                
                // Get the enrolment plugin for manual enrollments
                require_once($CFG->dirroot . '/lib/enrollib.php');
                $enrol = enrol_get_plugin('manual');
                
                // Get the manual enrolment instance for this course
                $instance = $DB->get_record('enrol', [
                    'courseid' => $newcourse->id,
                    'enrol' => 'manual'
                ], '*', MUST_EXIST);
                
                // Enrol the creator with the configured role
                $enrol->enrol_user($instance, $user->id, $CFG->creatornewroleid, 0, 0, ENROL_USER_ACTIVE);
            }

            // Step 11: Return standardized JSON response with HTTP 201 Created status
            // Include the complete course object in the response
            $responsedata = [
                'course' => [
                    'id' => $newcourse->id,
                    'fullname' => $newcourse->fullname,
                    'shortname' => $newcourse->shortname,
                    'category' => $newcourse->category,
                    'summary' => $newcourse->summary,
                    'summaryformat' => $newcourse->summaryformat,
                    'format' => $newcourse->format,
                    'visible' => $newcourse->visible,
                    'startdate' => $newcourse->startdate,
                    'enddate' => $newcourse->enddate,
                    'maxbytes' => $newcourse->maxbytes,
                    'showgrades' => $newcourse->showgrades,
                    'showreports' => $newcourse->showreports,
                    'newsitems' => $newcourse->newsitems,
                    'groupmode' => $newcourse->groupmode,
                    'groupmodeforce' => $newcourse->groupmodeforce,
                    'defaultgroupingid' => $newcourse->defaultgroupingid,
                    'enablecompletion' => $newcourse->enablecompletion,
                    'completionnotify' => $newcourse->completionnotify,
                    'lang' => $newcourse->lang,
                    'theme' => $newcourse->theme,
                    'idnumber' => $newcourse->idnumber,
                    'timecreated' => $newcourse->timecreated,
                    'timemodified' => $newcourse->timemodified,
                    'url' => (string) new moodle_url('/course/view.php', ['id' => $newcourse->id])
                ]
            ];

            // Return success response with 201 Created status
            $this->success($responsedata, 201);

        } catch (ApiException $e) {
            // Re-throw API exceptions to be handled by base class
            throw $e;
        } catch (Exception $e) {
            // Catch any unexpected exceptions and wrap them
            throw new ServerException('An error occurred while creating the course: ' . $e->getMessage(), [
                'error' => $e->getMessage(),
                'trace' => $CFG->debugdeveloper ? $e->getTraceAsString() : null
            ]);
        }
    }
    
    /**
     * Handle PUT requests - not allowed for course creation.
     *
     * PUT requests are used for updating existing resources. For updating courses,
     * use the PUT /api/v1/courses/{id} endpoint instead.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not allowed for course creation. Use PUT /api/v1/courses/{id} to update an existing course.');
    }
    
    /**
     * Handle DELETE requests - not allowed for course creation.
     *
     * DELETE requests are used for deleting existing resources. For deleting courses,
     * use the DELETE /api/v1/courses/{id} endpoint instead.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed for course creation. Use DELETE /api/v1/courses/{id} to delete a course.');
    }
}

// Instantiate endpoint and execute request handling.
// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new CourseCreateEndpoint();
    $endpoint->execute();
}
