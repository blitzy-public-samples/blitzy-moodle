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
 * REST API endpoint for retrieving SCORM package details.
 *
 * Handles GET /api/v1/scorm/{id} to fetch complete SCORM activity information
 * including metadata, configuration settings, grading options, attempt status,
 * and availability. Returns JSON-formatted SCORM object with all parameters
 * needed to initialize SCORM player display in React frontend.
 *
 * This endpoint is a thin wrapper that delegates all business logic to existing
 * Moodle SCORM functions, ensuring zero duplication and maintaining compatibility
 * with the existing SCORM engine.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and required libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/scorm/lib.php');
require_once($CFG->dirroot . '/mod/scorm/locallib.php');
require_once($CFG->libdir . '/filelib.php');

// Load API base classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * SCORM detail endpoint class.
 *
 * Extends ApiBase to inherit JWT validation, HTTP method routing, permission
 * checking, and response formatting. Implements handle_get() to process
 * SCORM detail retrieval requests.
 */
class ScormShowEndpoint extends ApiBase {
    
    /**
     * Handle GET requests for SCORM package details.
     *
     * Retrieves complete SCORM activity information including:
     * - Basic metadata (name, intro, version)
     * - Package configuration (type, reference, launch)
     * - Display settings (popup, dimensions, navigation)
     * - Grading settings (method, maxgrade, whatgrade)
     * - Attempt settings (maxattempt, force options, lock)
     * - User-specific data (attempt count, can_attempt status)
     * - Availability dates (timeopen, timeclose)
     * - Permissions (can_view_reports, can_delete_attempts)
     * - File information (package filename, size, URL)
     * - Optional attempt history (if include_attempts=true)
     *
     * All business logic delegated to existing Moodle SCORM functions.
     * No reimplementation of SCORM engine or grading calculations.
     *
     * @return void Outputs JSON response via success() method
     * @throws NotFoundException If SCORM activity or course module not found
     * @throws ForbiddenException If user lacks required permissions
     * @throws ValidationException If request parameters are invalid
     */
    protected function handle_get() {
        global $DB, $CFG, $USER;
        
        // Get authenticated user from JWT token (inherited from ApiBase)
        $user = $this->getUser();
        
        // Extract SCORM ID from URL parameter with integer validation
        $scormid = $this->getParam('id', PARAM_INT);
        
        // Validate SCORM ID is positive
        if ($scormid <= 0) {
            throw new ValidationException('Invalid SCORM ID', [
                'parameter' => 'id',
                'value' => $scormid,
                'reason' => 'SCORM ID must be a positive integer'
            ]);
        }
        
        // Retrieve SCORM record from database using existing Moodle function
        $scorm = $DB->get_record('scorm', ['id' => $scormid], '*', IGNORE_MISSING);
        
        if (!$scorm) {
            throw new NotFoundException('SCORM activity not found', [
                'scormId' => $scormid,
                'reason' => 'No SCORM activity exists with this ID'
            ]);
        }
        
        // Retrieve course module using existing Moodle function
        $cm = get_coursemodule_from_instance('scorm', $scormid, 0, false, IGNORE_MISSING);
        
        if (!$cm) {
            throw new NotFoundException('Course module not found', [
                'scormId' => $scormid,
                'reason' => 'SCORM activity exists but course module is missing'
            ]);
        }
        
        // Retrieve course record
        $course = $DB->get_record('course', ['id' => $scorm->course], '*', MUST_EXIST);
        
        if (!$course) {
            throw new NotFoundException('Course not found', [
                'courseId' => $scorm->course,
                'reason' => 'Course associated with SCORM activity does not exist'
            ]);
        }
        
        // Get module context for permission checks
        $context = context_module::instance($cm->id);
        
        // Enforce permission check - user must be able to view SCORM scores
        // This allows viewing the SCORM activity (basic viewing permission)
        $this->checkCapability('mod/scorm:viewscores', $context);
        
        // Check additional capabilities for user-specific permissions
        $can_attempt = has_capability('mod/scorm:savetrack', $context, $user->id);
        $can_view_reports = has_capability('mod/scorm:viewreport', $context, $user->id);
        $can_delete_attempts = has_capability('mod/scorm:deleteresponses', $context, $user->id);
        
        // Trigger SCORM view event using existing Moodle event system
        $event = \mod_scorm\event\course_module_viewed::create([
            'objectid' => $scorm->id,
            'context' => $context,
            'other' => ['instanceid' => $scorm->id]
        ]);
        $event->add_record_snapshot('course', $course);
        $event->add_record_snapshot('scorm', $scorm);
        $event->trigger();
        
        // Get user's attempt count using existing SCORM function
        $attempt_count = scorm_get_attempt_count($user->id, $scorm);
        
        // Determine if user can start a new attempt based on maxattempt setting
        $can_start_new_attempt = false;
        $attempts_remaining = null;
        
        if ($can_attempt) {
            if ($scorm->maxattempt == 0) {
                // Unlimited attempts
                $can_start_new_attempt = true;
                $attempts_remaining = -1; // -1 indicates unlimited
            } else if ($attempt_count < $scorm->maxattempt) {
                // Still has attempts remaining
                $can_start_new_attempt = true;
                $attempts_remaining = $scorm->maxattempt - $attempt_count;
            } else {
                // Max attempts reached
                $can_start_new_attempt = false;
                $attempts_remaining = 0;
            }
        }
        
        // Determine SCORM version string from numeric constant
        $version_string = 'unknown';
        switch ($scorm->version) {
            case SCORM_12:
                $version_string = '1.2';
                break;
            case SCORM_13:
                $version_string = '2004';
                break;
            case SCORM_AICC:
                $version_string = 'AICC';
                break;
        }
        
        // Get SCORM package file information
        $file_info = $this->getScormPackageFile($context, $scorm);
        
        // Parse display settings
        $display_settings = [
            'popup' => (int)$scorm->popup,
            'width' => (int)$scorm->width,
            'height' => (int)$scorm->height,
            'skipview' => (int)$scorm->skipview,
            'hidebrowse' => (int)$scorm->hidebrowse,
            'hidetoc' => (int)$scorm->hidetoc,
            'nav' => (int)$scorm->nav,
            'navpositionleft' => (int)$scorm->navpositionleft,
            'navpositiontop' => (int)$scorm->navpositiontop,
            'auto' => (int)$scorm->auto,
            'displaycoursestructure' => (int)$scorm->displaycoursestructure,
            'displayattemptstatus' => (int)$scorm->displayattemptstatus,
        ];
        
        // Parse grading settings
        $grading_settings = [
            'grademethod' => (int)$scorm->grademethod,
            'maxgrade' => (float)$scorm->maxgrade,
            'whatgrade' => (int)$scorm->whatgrade,
        ];
        
        // Parse attempt settings
        $attempt_settings = [
            'maxattempt' => (int)$scorm->maxattempt,
            'forcecompleted' => (int)$scorm->forcecompleted,
            'forcenewattempt' => (int)$scorm->forcenewattempt,
            'lastattemptlock' => (int)$scorm->lastattemptlock,
            'attempt_count' => $attempt_count,
            'can_start_new_attempt' => $can_start_new_attempt,
            'attempts_remaining' => $attempts_remaining,
        ];
        
        // Build standardized SCORM response object
        $scorm_data = [
            'id' => (int)$scorm->id,
            'course' => (int)$scorm->course,
            'coursemoduleid' => (int)$cm->id,
            'name' => $scorm->name,
            'intro' => $scorm->intro,
            'introformat' => (int)$scorm->introformat,
            'version' => $version_string,
            'scormtype' => $scorm->scormtype,
            'reference' => $scorm->reference,
            'sha1hash' => $scorm->sha1hash,
            'revision' => (int)$scorm->revision,
            'launch' => $scorm->launch,
            'display_settings' => $display_settings,
            'grading_settings' => $grading_settings,
            'attempt_settings' => $attempt_settings,
            'file_info' => $file_info,
            'timeopen' => (int)$scorm->timeopen,
            'timeclose' => (int)$scorm->timeclose,
            'timemodified' => (int)$scorm->timemodified,
            'can_view_reports' => $can_view_reports,
            'can_delete_attempts' => $can_delete_attempts,
        ];
        
        // Optionally include attempt history if requested
        $include_attempts = $this->getParam('include_attempts', PARAM_BOOL, false, false);
        
        if ($include_attempts) {
            $scorm_data['attempt_history'] = $this->getAttemptHistory($scorm->id, $user->id);
        }
        
        // Return success response with SCORM data
        $this->success($scorm_data);
    }
    
    /**
     * Get SCORM package file information.
     *
     * Retrieves file metadata for the SCORM package including filename, size,
     * mimetype, and download URL. For external SCORM packages, returns reference
     * URL instead of file information.
     *
     * Delegates to existing Moodle file storage API - no file handling logic
     * reimplemented.
     *
     * @param context_module $context Module context for file access
     * @param stdClass $scorm SCORM activity record
     * @return array File information with keys: filename, filesize, mimetype, url, timecreated
     */
    private function getScormPackageFile($context, $scorm) {
        global $CFG;
        
        // For external SCORM packages, return reference URL
        if ($scorm->scormtype === SCORM_TYPE_EXTERNAL || $scorm->scormtype === SCORM_TYPE_AICCURL) {
            return [
                'type' => 'external',
                'url' => $scorm->reference,
                'filename' => null,
                'filesize' => null,
                'mimetype' => null,
                'timecreated' => null,
            ];
        }
        
        // For local packages, retrieve file from Moodle file storage
        $fs = get_file_storage();
        $files = $fs->get_area_files($context->id, 'mod_scorm', 'package', 0, 'sortorder, id', false);
        
        if (empty($files)) {
            return [
                'type' => 'local',
                'url' => null,
                'filename' => null,
                'filesize' => null,
                'mimetype' => null,
                'timecreated' => null,
            ];
        }
        
        // Get the first (and should be only) package file
        $file = reset($files);
        
        // Build download URL using pluginfile.php
        $url = moodle_url::make_pluginfile_url(
            $context->id,
            'mod_scorm',
            'package',
            0,
            '/',
            $file->get_filename()
        );
        
        return [
            'type' => 'local',
            'url' => $url->out(false),
            'filename' => $file->get_filename(),
            'filesize' => $file->get_filesize(),
            'mimetype' => $file->get_mimetype(),
            'timecreated' => $file->get_timecreated(),
        ];
    }
    
    /**
     * Get user's attempt history for SCORM activity.
     *
     * Retrieves list of all attempts made by the user including attempt number,
     * status, score, and timestamps. Uses existing SCORM tracking functions
     * to query attempt data.
     *
     * @param int $scormid SCORM activity ID
     * @param int $userid User ID
     * @return array Array of attempt records with keys: attempt, status, score, timestarted, timecompleted
     */
    private function getAttemptHistory($scormid, $userid) {
        global $DB;
        
        // Query user's attempts from scorm_attempt table (correct table per install.xml)
        // The scorm_attempt table contains the primary attempt records
        $sql = "SELECT DISTINCT attempt
                FROM {scorm_attempt}
                WHERE scormid = :scormid AND userid = :userid
                ORDER BY attempt ASC";
        
        $attempts = $DB->get_records_sql($sql, ['scormid' => $scormid, 'userid' => $userid]);
        
        $attempt_history = [];
        
        foreach ($attempts as $attempt) {
            $attempt_number = $attempt->attempt;
            
            // Extract key information from attempt
            $attempt_info = [
                'attempt' => (int)$attempt_number,
                'status' => 'incomplete',
                'score' => null,
                'timestarted' => null,
                'timecompleted' => null,
            ];
            
            // Get all SCOs for this SCORM activity using existing function
            $scoes = scorm_get_scoes($scormid);
            
            if (!empty($scoes)) {
                // Loop through each SCO and get tracking data
                foreach ($scoes as $sco) {
                    // Get tracking data for this specific SCO
                    $sco_tracks = scorm_get_tracks($sco->id, $userid, $attempt_number);
                    
                    if (!empty($sco_tracks)) {
                        // Check for completion status
                        if (isset($sco_tracks->{'cmi.core.lesson_status'})) {
                            $attempt_info['status'] = $sco_tracks->{'cmi.core.lesson_status'};
                        } else if (isset($sco_tracks->{'cmi.completion_status'})) {
                            $attempt_info['status'] = $sco_tracks->{'cmi.completion_status'};
                        }
                        
                        // Check for score
                        if (isset($sco_tracks->{'cmi.core.score.raw'})) {
                            $attempt_info['score'] = (float)$sco_tracks->{'cmi.core.score.raw'};
                        } else if (isset($sco_tracks->{'cmi.score.raw'})) {
                            $attempt_info['score'] = (float)$sco_tracks->{'cmi.score.raw'};
                        }
                        
                        // Get timestamps
                        if (isset($sco_tracks->timemodified)) {
                            if ($attempt_info['timestarted'] === null || $sco_tracks->timemodified < $attempt_info['timestarted']) {
                                $attempt_info['timestarted'] = (int)$sco_tracks->timemodified;
                            }
                            if ($attempt_info['timecompleted'] === null || $sco_tracks->timemodified > $attempt_info['timecompleted']) {
                                $attempt_info['timecompleted'] = (int)$sco_tracks->timemodified;
                            }
                        }
                    }
                }
            }
            
            $attempt_history[] = $attempt_info;
        }
        
        return $attempt_history;
    }
    
    /**
     * Handle POST requests - not supported.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for this endpoint');
    }
    
    /**
     * Handle PUT requests - not supported.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for this endpoint');
    }
    
    /**
     * Handle DELETE requests - not supported.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for this endpoint');
    }
}

// Instantiate and execute the endpoint
$endpoint = new ScormShowEndpoint();
$endpoint->execute();
