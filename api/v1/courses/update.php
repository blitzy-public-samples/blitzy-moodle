<?php
/**
 * API endpoint for updating course properties and settings.
 *
 * This endpoint provides a RESTful PUT interface for updating existing courses in Moodle.
 * It accepts JSON payloads with course field modifications and delegates to the existing
 * update_course() function while enforcing appropriate capability checks.
 *
 * @package    api
 * @subpackage v1
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Moodle configuration and core library.
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/lib/moodlelib.php');
require_once($CFG->dirroot . '/lib/accesslib.php');

// API utilities.
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Course update endpoint class.
 *
 * Handles PUT requests for updating course properties and settings.
 * Validates input, enforces permissions, and delegates to core Moodle functions.
 */
class CoursesUpdateEndpoint extends ApiBase {

    /**
     * Handle PUT requests to update a course.
     *
     * Accepts a JSON payload with course fields to update. Validates all inputs,
     * enforces capability checks, and calls the existing update_course() function.
     * Returns the updated course data in a standardized JSON response.
     *
     * Expected URL format: PUT /api/v1/courses/{id}
     * Required capabilities: moodle/course:update (base), moodle/course:changecategory (if category changes),
     *                        moodle/course:visibility (if visibility changes)
     *
     * Updatable fields: fullname, shortname, category (categoryid), summary, summaryformat, format,
     *                   showgrades, newsitems, startdate, enddate, maxbytes, showreports, visible,
     *                   groupmode, groupmodeforce, defaultgroupingid, enablecompletion, completionnotify,
     *                   lang, theme, marker, legacysortorder, customfields
     *
     * @return void
     * @throws ValidationException If input validation fails
     * @throws NotFoundException If course does not exist
     * @throws ForbiddenException If user lacks required permissions
     * @throws ServerException If an unexpected error occurs
     */
    protected function handle_put() {
        global $DB, $CFG, $USER;

        try {
            // Extract course ID from URL path parameter.
            $courseid = $this->getParam('id', PARAM_INT, true);

            // Verify course exists. Will throw an exception if not found.
            $existingcourse = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);
            if (!$existingcourse) {
                throw new NotFoundException('Course with ID ' . $courseid . ' not found');
            }

            // Prevent updates to the site course (course ID 1 / SITEID).
            if ($courseid == SITEID) {
                throw new ValidationException('Cannot update the site course');
            }

            // Get course context for capability checking.
            $coursecontext = context_course::instance($courseid);

            // Check if user has permission to update the course.
            $this->checkCapability('moodle/course:update', $coursecontext);

            // Extract optional parameters from PUT body.
            // Only include parameters that are actually provided.
            $fullname = $this->getParam('fullname', PARAM_TEXT, false, null);
            $shortname = $this->getParam('shortname', PARAM_TEXT, false, null);
            $categoryid = $this->getParam('category', PARAM_INT, false, null);
            $summary = $this->getParam('summary', PARAM_RAW, false, null);
            $summaryformat = $this->getParam('summaryformat', PARAM_INT, false, null);
            $format = $this->getParam('format', PARAM_ALPHA, false, null);
            $showgrades = $this->getParam('showgrades', PARAM_INT, false, null);
            $newsitems = $this->getParam('newsitems', PARAM_INT, false, null);
            $startdate = $this->getParam('startdate', PARAM_INT, false, null);
            $enddate = $this->getParam('enddate', PARAM_INT, false, null);
            $maxbytes = $this->getParam('maxbytes', PARAM_INT, false, null);
            $showreports = $this->getParam('showreports', PARAM_INT, false, null);
            $visible = $this->getParam('visible', PARAM_INT, false, null);
            $groupmode = $this->getParam('groupmode', PARAM_INT, false, null);
            $groupmodeforce = $this->getParam('groupmodeforce', PARAM_INT, false, null);
            $defaultgroupingid = $this->getParam('defaultgroupingid', PARAM_INT, false, null);
            $enablecompletion = $this->getParam('enablecompletion', PARAM_INT, false, null);
            $completionnotify = $this->getParam('completionnotify', PARAM_INT, false, null);
            $lang = $this->getParam('lang', PARAM_ALPHANUMEXT, false, null);
            $theme = $this->getParam('theme', PARAM_ALPHANUMEXT, false, null);
            $marker = $this->getParam('marker', PARAM_INT, false, null);
            $legacysortorder = $this->getParam('legacysortorder', PARAM_INT, false, null);
            $customfields = $this->getParam('customfields', PARAM_RAW, false, null);

            // Build course data object starting with existing course.
            $coursedata = new stdClass();
            $coursedata->id = $courseid;

            // Track which fields are being changed for capability checks and logging.
            $changedfields = [];

            // Update only provided fields with comprehensive validation.
            
            // Full name validation.
            if ($fullname !== null) {
                if (empty(trim($fullname))) {
                    throw new ValidationException('Course full name cannot be empty');
                }
                $coursedata->fullname = $fullname;
                $changedfields[] = 'fullname';
            }

            // Short name validation and uniqueness check.
            if ($shortname !== null) {
                if (empty(trim($shortname))) {
                    throw new ValidationException('Course short name cannot be empty');
                }
                // Check if shortname is already in use by a different course.
                $existing = $DB->get_record('course', ['shortname' => $shortname]);
                if ($existing && $existing->id != $courseid) {
                    throw new ValidationException('Course with short name "' . $shortname . '" already exists');
                }
                $coursedata->shortname = $shortname;
                $changedfields[] = 'shortname';
            }

            // Category validation and capability check if category is being changed.
            if ($categoryid !== null) {
                if ($categoryid <= 0) {
                    throw new ValidationException('Invalid category ID. Must be a positive integer');
                }
                // Verify the category exists.
                $targetcategory = $DB->get_record('course_categories', ['id' => $categoryid]);
                if (!$targetcategory) {
                    throw new ValidationException('Course category with ID ' . $categoryid . ' not found');
                }
                
                // If category is being changed, enforce additional capability check.
                if ($existingcourse->category != $categoryid) {
                    $this->checkCapability('moodle/course:changecategory', $coursecontext);
                    
                    // Also check if user has permission in target category context.
                    $targetcategorycontext = context_coursecat::instance($categoryid);
                    if (!has_capability('moodle/course:create', $targetcategorycontext)) {
                        throw new ForbiddenException('You do not have permission to move courses into category ' . $targetcategory->name);
                    }
                }
                
                $coursedata->category = $categoryid;
                $changedfields[] = 'category';
            }

            // Summary and format validation.
            if ($summary !== null) {
                $coursedata->summary = $summary;
                $changedfields[] = 'summary';
            }

            if ($summaryformat !== null) {
                if (!in_array($summaryformat, [FORMAT_HTML, FORMAT_MOODLE, FORMAT_PLAIN, FORMAT_MARKDOWN], true)) {
                    throw new ValidationException('Invalid summary format. Must be FORMAT_HTML (1), FORMAT_MOODLE (0), FORMAT_PLAIN (2), or FORMAT_MARKDOWN (4)');
                }
                $coursedata->summaryformat = $summaryformat;
                $changedfields[] = 'summaryformat';
            }

            // Course format validation.
            if ($format !== null) {
                $courseformats = get_plugin_list('format');
                if (!array_key_exists($format, $courseformats)) {
                    throw new ValidationException('Invalid course format "' . $format . '". Available formats: ' . implode(', ', array_keys($courseformats)));
                }
                $coursedata->format = $format;
                $changedfields[] = 'format';
            }

            // Show grades validation.
            if ($showgrades !== null) {
                if (!in_array($showgrades, [0, 1], true)) {
                    throw new ValidationException('Show grades must be 0 (hide) or 1 (show)');
                }
                $coursedata->showgrades = $showgrades;
                $changedfields[] = 'showgrades';
            }

            // News items validation.
            if ($newsitems !== null) {
                if ($newsitems < 0 || $newsitems > 10) {
                    throw new ValidationException('News items must be between 0 and 10');
                }
                $coursedata->newsitems = $newsitems;
                $changedfields[] = 'newsitems';
            }

            // Date validation.
            if ($startdate !== null) {
                if ($startdate < 0) {
                    throw new ValidationException('Start date must be a valid Unix timestamp (non-negative integer)');
                }
                $coursedata->startdate = $startdate;
                $changedfields[] = 'startdate';
            }

            if ($enddate !== null) {
                // Validate end date against start date.
                $finalstartdate = isset($coursedata->startdate) ? $coursedata->startdate : $existingcourse->startdate;
                if ($enddate > 0 && $enddate < $finalstartdate) {
                    throw new ValidationException('End date (' . userdate($enddate) . ') cannot be before start date (' . userdate($finalstartdate) . ')');
                }
                $coursedata->enddate = $enddate;
                $changedfields[] = 'enddate';
            }

            // Max bytes validation.
            if ($maxbytes !== null) {
                $systemmax = (int)get_config('core', 'maxbytes');
                if ($maxbytes < 0) {
                    throw new ValidationException('Max bytes must be a non-negative integer');
                }
                if ($systemmax > 0 && $maxbytes > $systemmax) {
                    throw new ValidationException('Max bytes (' . display_size($maxbytes) . ') exceeds system maximum (' . display_size($systemmax) . ')');
                }
                $coursedata->maxbytes = $maxbytes;
                $changedfields[] = 'maxbytes';
            }

            // Show reports validation.
            if ($showreports !== null) {
                if (!in_array($showreports, [0, 1], true)) {
                    throw new ValidationException('Show reports must be 0 (hide) or 1 (show)');
                }
                $coursedata->showreports = $showreports;
                $changedfields[] = 'showreports';
            }

            // Visibility validation and capability check if visibility is being changed.
            if ($visible !== null) {
                if (!in_array($visible, [0, 1], true)) {
                    throw new ValidationException('Visible must be 0 (hide) or 1 (show)');
                }
                
                // If visibility is being changed, enforce additional capability check.
                if ($existingcourse->visible != $visible) {
                    $this->checkCapability('moodle/course:visibility', $coursecontext);
                }
                
                $coursedata->visible = $visible;
                $changedfields[] = 'visible';
            }

            // Group mode validation.
            if ($groupmode !== null) {
                if (!in_array($groupmode, [NOGROUPS, SEPARATEGROUPS, VISIBLEGROUPS], true)) {
                    throw new ValidationException('Group mode must be NOGROUPS (0), SEPARATEGROUPS (1), or VISIBLEGROUPS (2)');
                }
                $coursedata->groupmode = $groupmode;
                $changedfields[] = 'groupmode';
            }

            // Group mode force validation.
            if ($groupmodeforce !== null) {
                if (!in_array($groupmodeforce, [0, 1], true)) {
                    throw new ValidationException('Group mode force must be 0 or 1');
                }
                $coursedata->groupmodeforce = $groupmodeforce;
                $changedfields[] = 'groupmodeforce';
            }

            // Default grouping validation.
            if ($defaultgroupingid !== null) {
                if ($defaultgroupingid < 0) {
                    throw new ValidationException('Default grouping ID must be a non-negative integer (0 for none)');
                }
                if ($defaultgroupingid > 0) {
                    // Verify the grouping exists and belongs to this course.
                    $grouping = $DB->get_record('groupings', ['id' => $defaultgroupingid, 'courseid' => $courseid]);
                    if (!$grouping) {
                        throw new ValidationException('Grouping with ID ' . $defaultgroupingid . ' not found in this course');
                    }
                }
                $coursedata->defaultgroupingid = $defaultgroupingid;
                $changedfields[] = 'defaultgroupingid';
            }

            // Completion settings validation.
            if ($enablecompletion !== null) {
                if (!in_array($enablecompletion, [0, 1], true)) {
                    throw new ValidationException('Enable completion must be 0 (disabled) or 1 (enabled)');
                }
                // Check if completion is enabled system-wide.
                if ($enablecompletion == 1 && !$CFG->enablecompletion) {
                    throw new ValidationException('Course completion is disabled system-wide. Cannot enable for this course');
                }
                $coursedata->enablecompletion = $enablecompletion;
                $changedfields[] = 'enablecompletion';
            }

            if ($completionnotify !== null) {
                if (!in_array($completionnotify, [0, 1], true)) {
                    throw new ValidationException('Completion notify must be 0 (disabled) or 1 (enabled)');
                }
                $coursedata->completionnotify = $completionnotify;
                $changedfields[] = 'completionnotify';
            }

            // Language validation.
            if ($lang !== null) {
                // Empty string is valid (means inherit from site default).
                if ($lang !== '') {
                    $installedlangs = get_string_manager()->get_list_of_translations();
                    if (!array_key_exists($lang, $installedlangs)) {
                        throw new ValidationException('Language code "' . $lang . '" is not installed. Available languages: ' . implode(', ', array_keys($installedlangs)));
                    }
                }
                $coursedata->lang = $lang;
                $changedfields[] = 'lang';
            }

            // Theme validation.
            if ($theme !== null) {
                // Empty string is valid (means use site default theme).
                if ($theme !== '') {
                    $allowedthemes = get_list_of_themes();
                    if (!array_key_exists($theme, $allowedthemes)) {
                        throw new ValidationException('Theme "' . $theme . '" is not available. Available themes: ' . implode(', ', array_keys($allowedthemes)));
                    }
                }
                $coursedata->theme = $theme;
                $changedfields[] = 'theme';
            }

            // Section marker validation.
            if ($marker !== null) {
                if ($marker < 0) {
                    throw new ValidationException('Marker must be a non-negative integer (0 for no marker)');
                }
                $coursedata->marker = $marker;
                $changedfields[] = 'marker';
            }

            // Legacy sort order validation.
            if ($legacysortorder !== null) {
                if ($legacysortorder < 0) {
                    throw new ValidationException('Legacy sort order must be a non-negative integer');
                }
                $coursedata->legacysortorder = $legacysortorder;
                $changedfields[] = 'legacysortorder';
            }

            // Log the course update attempt for audit trail.
            $logdata = [
                'courseid' => $courseid,
                'userid' => $USER->id,
                'fields' => $changedfields,
                'timestamp' => time()
            ];
            error_log('Course update attempt: ' . json_encode($logdata));

            // Call existing Moodle function to update the course.
            // This function handles all validation, database operations, events, and caching.
            update_course($coursedata);

            // Handle custom fields if provided.
            if ($customfields !== null && is_array($customfields)) {
                try {
                    // Get custom field handler for courses.
                    $handler = \core_customfield\handler::get_handler('core_course', 'course');
                    
                    // Prepare custom field data.
                    $customfielddata = [];
                    foreach ($customfields as $field) {
                        if (isset($field['shortname']) && isset($field['value'])) {
                            $customfielddata[$field['shortname']] = $field['value'];
                        }
                    }
                    
                    // Save custom field data if we have any.
                    if (!empty($customfielddata)) {
                        $handler->instance_form_save((object)$customfielddata, $courseid);
                        $changedfields[] = 'customfields';
                    }
                } catch (Exception $e) {
                    // Log custom field errors but don't fail the entire update.
                    error_log('Custom field update warning for course ' . $courseid . ': ' . $e->getMessage());
                }
            }

            // Retrieve the updated course to return complete data.
            $updatedcourse = get_course($courseid);

            // Prepare comprehensive response data with all updatable fields.
            $responsedata = [
                'id' => $updatedcourse->id,
                'fullname' => $updatedcourse->fullname,
                'shortname' => $updatedcourse->shortname,
                'category' => $updatedcourse->category,
                'summary' => $updatedcourse->summary,
                'summaryformat' => (int)$updatedcourse->summaryformat,
                'format' => $updatedcourse->format,
                'showgrades' => (int)$updatedcourse->showgrades,
                'newsitems' => (int)$updatedcourse->newsitems,
                'startdate' => (int)$updatedcourse->startdate,
                'enddate' => (int)$updatedcourse->enddate,
                'maxbytes' => (int)$updatedcourse->maxbytes,
                'showreports' => (int)$updatedcourse->showreports,
                'visible' => (int)$updatedcourse->visible,
                'groupmode' => (int)$updatedcourse->groupmode,
                'groupmodeforce' => (int)$updatedcourse->groupmodeforce,
                'defaultgroupingid' => (int)$updatedcourse->defaultgroupingid,
                'enablecompletion' => (int)$updatedcourse->enablecompletion,
                'completionnotify' => (int)$updatedcourse->completionnotify,
                'lang' => $updatedcourse->lang,
                'theme' => $updatedcourse->theme ?? '',
                'marker' => (int)$updatedcourse->marker,
                'legacysortorder' => (int)$updatedcourse->legacysortorder,
                'timecreated' => (int)$updatedcourse->timecreated,
                'timemodified' => (int)$updatedcourse->timemodified,
                'changed_fields' => $changedfields
            ];

            // Log successful update.
            $successlog = [
                'courseid' => $courseid,
                'userid' => $USER->id,
                'action' => 'course_updated',
                'fields' => $changedfields,
                'timestamp' => time(),
                'success' => true
            ];
            error_log('Course update successful: ' . json_encode($successlog));

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
                // Log the unexpected error for debugging.
                error_log('Course update error: ' . $e->getMessage() . ' | Trace: ' . $e->getTraceAsString());
                // Generic server error for unexpected Moodle exceptions.
                throw new ServerException('Failed to update course: ' . $e->getMessage());
            }
        } catch (ApiException $e) {
            // Re-throw API exceptions (already properly formatted).
            throw $e;
        } catch (Exception $e) {
            // Catch any other unexpected exceptions.
            error_log('Unexpected course update error: ' . $e->getMessage() . ' | Trace: ' . $e->getTraceAsString());
            throw new ServerException('An unexpected error occurred while updating the course');
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
