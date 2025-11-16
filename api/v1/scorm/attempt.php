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
 * REST API endpoint for initializing or retrieving SCORM learning attempts.
 *
 * Handles POST /api/v1/scorm/{id}/attempt to create new learning attempts or 
 * retrieve existing ones. This endpoint wraps existing Moodle SCORM functions
 * and provides JSON-formatted attempt objects for React frontend SCORM player
 * to begin tracking learner progress through SCORM content.
 *
 * The endpoint supports:
 * - Creating new SCORM attempts with proper validation
 * - Retrieving existing attempts for continuation
 * - Validating attempt limits per SCORM configuration
 * - Determining launch SCO based on progress
 * - Supporting both SCORM 1.2 and SCORM 2004 standards
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include Moodle configuration and required libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/scorm/lib.php');
require_once($CFG->dirroot . '/mod/scorm/locallib.php');

// Include API base class and exception handlers
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * SCORM Attempt API endpoint class.
 *
 * Extends ApiBase to handle POST /api/v1/scorm/{id}/attempt requests for
 * initializing or retrieving SCORM learning attempts. This class provides
 * the bridge between React frontend SCORM player and existing Moodle SCORM
 * engine functions.
 *
 * Example usage from React frontend:
 * <code>
 * POST /api/v1/scorm/{id}/attempt
 * Authorization: Bearer <jwt_token>
 * Content-Type: application/json
 *
 * {
 *   "attempt": 2,  // Optional: specific attempt number (default: next attempt)
 *   "organization": ""  // Optional: SCORM organization ID (default: empty)
 * }
 * </code>
 *
 * Example response:
 * <code>
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "attempt": 2,
 *     "userid": 45,
 *     "scormid": 10,
 *     "scoes_count": 5,
 *     "launch_sco_id": 100,
 *     "timestarted": 1640000000,
 *     "status": "incomplete",
 *     "grade": null,
 *     "organization": "",
 *     "can_continue": true,
 *     "is_new": true
 *   }
 * }
 * </code>
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class ScormAttemptEndpoint extends ApiBase {
    
    /**
     * Handle POST request to create or retrieve SCORM attempt.
     *
     * This method orchestrates the entire SCORM attempt initialization process:
     * 1. Validates JWT token and extracts authenticated user
     * 2. Retrieves and validates SCORM ID from URL parameter
     * 3. Validates course module and enrollment
     * 4. Checks user permissions (mod/scorm:savetrack capability)
     * 5. Validates attempt limits based on SCORM configuration
     * 6. Creates new attempt or retrieves existing attempt
     * 7. Initializes tracking data for new attempts
     * 8. Determines launch SCO based on progress and configuration
     * 9. Returns comprehensive attempt information
     *
     * @return void Outputs JSON response and exits
     * @throws NotFoundException If SCORM ID invalid or course module not found
     * @throws ForbiddenException If user lacks permission or not enrolled
     * @throws ValidationException If attempt limit exceeded or invalid parameters
     */
    protected function handle_post() {
        global $DB, $CFG;
        
        // Get authenticated user from JWT token (via ApiBase constructor)
        $user = $this->getUser();
        $userid = $user->id;
        
        // Retrieve SCORM ID from URL parameter
        $scormid = $this->getParam('id', PARAM_INT);
        
        // Retrieve optional POST parameters
        $attemptnumber = optional_param('attempt', null, PARAM_INT);
        $organization = optional_param('organization', '', PARAM_RAW);
        
        // Validate SCORM record exists
        $scorm = $DB->get_record('scorm', ['id' => $scormid], '*', MUST_EXIST);
        if (!$scorm) {
            throw new NotFoundException('SCORM package not found', [
                'scormId' => $scormid
            ]);
        }
        
        // Retrieve course module
        $cm = get_coursemodule_from_instance('scorm', $scormid, 0, false, MUST_EXIST);
        if (!$cm) {
            throw new NotFoundException('Course module not found for SCORM package', [
                'scormId' => $scormid
            ]);
        }
        
        // Retrieve course record
        $course = $DB->get_record('course', ['id' => $scorm->course], '*', MUST_EXIST);
        if (!$course) {
            throw new NotFoundException('Course not found', [
                'courseId' => $scorm->course
            ]);
        }
        
        // Validate user enrollment in course
        $context = context_module::instance($cm->id);
        if (!is_enrolled($context, $user)) {
            throw new ForbiddenException('You are not enrolled in this course', [
                'courseId' => $course->id,
                'userId' => $userid
            ]);
        }
        
        // Check if module is hidden and user doesn't have permission to view hidden activities
        if (!$cm->visible && !has_capability('moodle/course:viewhiddenactivities', $context)) {
            throw new ForbiddenException('This SCORM package is not currently available', [
                'scormId' => $scormid,
                'visible' => $cm->visible
            ]);
        }
        
        // Enforce permission check using require_capability wrapper
        // This checks if user has permission to save tracking data (attempt SCORM)
        $this->checkCapability('mod/scorm:savetrack', $context);
        
        // Validate organization parameter against existing SCOes if provided
        if (!empty($organization)) {
            // PARAM_RAW is used, so validate against database records
            if (!$DB->record_exists('scorm_scoes', ['scorm' => $scormid, 'identifier' => $organization])) {
                throw new ValidationException('Invalid organization identifier', [
                    'organization' => $organization,
                    'scormId' => $scormid
                ]);
            }
        }
        
        // Get current attempt count for this user
        $attemptcount = scorm_get_attempt_count($userid, $scorm);
        
        // Determine which attempt number to use
        if ($attemptnumber === null) {
            // No attempt specified - use next attempt number
            $attemptnumber = $attemptcount + 1;
            $isnewattempt = true;
        } else {
            // Specific attempt number requested - validate it
            if ($attemptnumber < 1) {
                throw new ValidationException('Invalid attempt number', [
                    'attempt' => $attemptnumber,
                    'message' => 'Attempt number must be positive'
                ]);
            }
            
            if ($attemptnumber > $attemptcount + 1) {
                throw new ValidationException('Invalid attempt number', [
                    'attempt' => $attemptnumber,
                    'currentAttempts' => $attemptcount,
                    'message' => 'Cannot skip attempt numbers'
                ]);
            }
            
            // Check if this is a new attempt or existing attempt
            $isnewattempt = ($attemptnumber > $attemptcount);
        }
        
        // Check attempt limits if creating new attempt
        if ($isnewattempt) {
            // $scorm->maxattempt: 0 = unlimited, >0 = maximum attempts allowed
            if ($scorm->maxattempt > 0 && $attemptcount >= $scorm->maxattempt) {
                throw new ValidationException('Maximum attempt limit reached', [
                    'maxAttempts' => $scorm->maxattempt,
                    'currentAttempts' => $attemptcount,
                    'message' => 'You have used all available attempts for this SCORM package'
                ]);
            }
        }
        
        // Get or create attempt record using existing Moodle function
        // Fourth parameter true means create if doesn't exist
        $attemptobject = scorm_get_attempt($userid, $scormid, $attemptnumber, true);
        
        if (!$attemptobject) {
            // This should not happen if scorm_get_attempt works correctly,
            // but handle gracefully just in case
            throw new ValidationException('Failed to create or retrieve attempt', [
                'userId' => $userid,
                'scormId' => $scormid,
                'attemptNumber' => $attemptnumber
            ]);
        }
        
        // If this is a new attempt, initialize tracking data
        if ($isnewattempt) {
            // Insert x.start.time tracking element to mark attempt start
            // This is required for SCORM tracking
            $result = scorm_insert_track($userid, $scormid, 0, $attemptnumber, 'x.start.time', time());
            
            // Trigger attempt_started event for Moodle event system
            $event = \mod_scorm\event\attempt_started::create([
                'objectid' => $attemptobject->id,
                'context' => $context,
                'relateduserid' => $userid,
                'other' => [
                    'attemptnum' => $attemptnumber,
                    'scormid' => $scormid
                ]
            ]);
            $event->trigger();
        }
        
        // Get attempt status information using existing Moodle function
        // This returns comprehensive status including completion, grade, etc.
        $attemptstatus = scorm_get_attempt_status($user, $scorm, $cm);
        
        // Get list of SCOs (Sharable Content Objects) for this SCORM package
        $scoes = scorm_get_scoes($scormid, $organization);
        
        // Determine launch SCO (which SCO to launch first/next)
        $launchsco = null;
        
        if (!empty($scoes)) {
            // If skipview is enabled, try to find first incomplete SCO
            if ($scorm->skipview == SCORM_SKIPVIEW_ALWAYS || 
                ($scorm->skipview == SCORM_SKIPVIEW_FIRST && $attemptnumber == 1)) {
                
                // Use scorm_get_toc to get TOC with status information
                $toc = scorm_get_toc($user, $scorm, $cm->id, TOCJSLINK, $organization, '', 
                                     'normal', $attemptnumber, true, true);
                
                // Find first incomplete or not attempted SCO
                $foundincomplete = false;
                foreach ($toc as $tocitem) {
                    if (isset($tocitem->url) && !empty($tocitem->url)) {
                        // Check if this SCO is not completed
                        if (empty($tocitem->status) || 
                            ($tocitem->status != 'completed' && $tocitem->status != 'passed')) {
                            $launchsco = $tocitem->id;
                            $foundincomplete = true;
                            break;
                        }
                    }
                }
                
                // If all SCOs completed or none found, use first launchable SCO
                if (!$foundincomplete && !empty($scoes)) {
                    foreach ($scoes as $sco) {
                        if (!empty($sco->launch)) {
                            $launchsco = $sco->id;
                            break;
                        }
                    }
                }
            } else {
                // Use default launch SCO from SCORM package configuration
                if (!empty($scorm->launch)) {
                    $launchsco = $scorm->launch;
                } else {
                    // Find first launchable SCO
                    foreach ($scoes as $sco) {
                        if (!empty($sco->launch)) {
                            $launchsco = $sco->id;
                            break;
                        }
                    }
                }
            }
        }
        
        // Determine attempt status string
        $statusstring = 'not attempted';
        if (!empty($attemptstatus) && isset($attemptstatus['attempts'])) {
            $currentattempt = null;
            foreach ($attemptstatus['attempts'] as $att) {
                if ($att->attemptnum == $attemptnumber) {
                    $currentattempt = $att;
                    break;
                }
            }
            
            if ($currentattempt) {
                // Determine status based on attempt data
                if (!empty($currentattempt->timemodified)) {
                    // Attempt has been accessed
                    $statusstring = 'incomplete';
                    
                    // Check for completion status from tracking data
                    $tracks = $DB->get_records('scorm_scoes_track', 
                        ['userid' => $userid, 'scormid' => $scormid, 'attempt' => $attemptnumber, 'element' => 'cmi.core.lesson_status'],
                        '', 'scoid, value');
                    
                    if (!empty($tracks)) {
                        $allcompleted = true;
                        $anypassed = false;
                        $anyfailed = false;
                        
                        foreach ($tracks as $track) {
                            $value = strtolower($track->value);
                            if ($value == 'completed' || $value == 'passed') {
                                if ($value == 'passed') {
                                    $anypassed = true;
                                }
                            } else if ($value == 'failed') {
                                $anyfailed = true;
                                $allcompleted = false;
                            } else {
                                $allcompleted = false;
                            }
                        }
                        
                        if ($anypassed) {
                            $statusstring = 'passed';
                        } else if ($anyfailed) {
                            $statusstring = 'failed';
                        } else if ($allcompleted) {
                            $statusstring = 'completed';
                        }
                    }
                }
            }
        }
        
        // Get current grade if available
        $grade = null;
        if (!empty($attemptstatus) && isset($attemptstatus['attempts'])) {
            foreach ($attemptstatus['attempts'] as $att) {
                if ($att->attemptnum == $attemptnumber) {
                    if (isset($att->scorescorm) && $att->scorescorm !== null) {
                        $grade = $att->scorescorm;
                    }
                    break;
                }
            }
        }
        
        // Determine if user can continue this attempt
        $cancontinue = true;
        if ($statusstring == 'completed' || $statusstring == 'passed') {
            // Check if force new attempt is enabled
            if ($scorm->forceattempt == SCORM_FORCEATTEMPT_ALWAYS || 
                ($scorm->forceattempt == SCORM_FORCEATTEMPT_ONCOMPLETE && 
                 ($statusstring == 'completed' || $statusstring == 'passed'))) {
                $cancontinue = false;
            }
        }
        
        // Build response object with comprehensive attempt information
        $response = [
            'id' => (int)$attemptobject->id,
            'attempt' => (int)$attemptnumber,
            'userid' => (int)$userid,
            'scormid' => (int)$scormid,
            'scoes_count' => count($scoes),
            'launch_sco_id' => $launchsco ? (int)$launchsco : null,
            'timestarted' => (int)$attemptobject->timemodified,
            'status' => $statusstring,
            'grade' => $grade !== null ? (float)$grade : null,
            'organization' => $organization,
            'can_continue' => $cancontinue,
            'is_new' => $isnewattempt,
            'max_attempts' => (int)$scorm->maxattempt,
            'current_attempts' => (int)$attemptcount + ($isnewattempt ? 1 : 0),
            'scorm_name' => format_string($scorm->name),
            'scorm_intro' => format_text($scorm->intro, $scorm->introformat),
        ];
        
        // Return success response using ApiBase helper method
        $this->success($response);
    }
    
    /**
     * Handle GET request - not supported for this endpoint.
     *
     * SCORM attempts cannot be retrieved via GET. Use dedicated query endpoints
     * for retrieving attempt data. This endpoint is specifically for creating
     * or initializing attempts via POST.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method is not supported for SCORM attempt creation. Use POST to create or initialize attempts.');
    }
    
    /**
     * Handle PUT request - not supported for this endpoint.
     *
     * SCORM attempts cannot be updated via PUT. Tracking data should be updated
     * through dedicated tracking endpoints. This endpoint is specifically for
     * creating or initializing attempts via POST.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for SCORM attempt creation. Use POST to create or initialize attempts.');
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint.
     *
     * SCORM attempts cannot be deleted via this endpoint. Attempt deletion
     * should be handled through administrative interfaces with proper
     * validation and logging. This endpoint is specifically for creating
     * or initializing attempts via POST.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for SCORM attempt creation. Use POST to create or initialize attempts.');
    }
}

// Instantiate and execute the endpoint
$endpoint = new ScormAttemptEndpoint();
$endpoint->execute();
