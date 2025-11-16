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
 * BigBlueButton Meeting Detail API Endpoint
 *
 * REST API endpoint that retrieves comprehensive BigBlueButton meeting details
 * and activity configuration. Implements GET /api/v1/bigbluebuttonbn/{id} with
 * JWT authentication, permission validation, and structured JSON response.
 *
 * This endpoint follows the thin wrapper pattern - it delegates all business logic
 * to existing Moodle core functions and returns meeting information including:
 * - Activity instance data (name, intro, type, timestamps)
 * - Meeting configuration (meetingid, passwords, recording settings)
 * - Group information and join permissions
 * - Current meeting status (running/not running)
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries.
// In test environment, these are already loaded by PHPUnit bootstrap or test script
if (!defined('PHPUNIT_TEST') && !defined('API_TEST_MODE')) {
    require_once(__DIR__ . '/../../../config.php');
    require_once($CFG->dirroot . '/lib/moodlelib.php');
}

// Load API base class and exceptions.
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Import BigBlueButton module classes.
use mod_bigbluebuttonbn\instance;
use mod_bigbluebuttonbn\meeting;
use mod_bigbluebuttonbn\plugin;

/**
 * BigBlueButton Show Endpoint
 *
 * Handles GET requests for retrieving BigBlueButton activity instance details.
 * Validates JWT token, checks permissions, and returns comprehensive meeting
 * information by delegating to existing Moodle BigBlueButton core functions.
 *
 * @package    core
 * @subpackage api
 */
class BigBlueButtonShowEndpoint extends ApiBase {

    /**
     * Handle GET request for BigBlueButton activity details.
     *
     * Retrieves comprehensive information about a BigBlueButton activity instance
     * including activity configuration, meeting settings, group information,
     * user permissions, and current meeting status.
     *
     * URL Format: GET /api/v1/bigbluebuttonbn/{id}
     * where {id} is the BigBlueButton instance ID (not course module ID)
     *
     * @return void Outputs JSON response directly
     * @throws NotFoundException If instance with given ID doesn't exist
     * @throws ForbiddenException If user lacks required capability
     * @throws ValidationException If ID parameter is invalid
     */
    protected function handle_get() {
        global $DB, $USER;

        // Extract instance ID from URL path segments.
        // Expected URL pattern: /api/v1/bigbluebuttonbn/{id}
        $pathparts = explode('/', trim($this->request_uri, '/'));
        
        // Find the position of 'bigbluebuttonbn' in the path.
        $bbbindex = array_search('bigbluebuttonbn', $pathparts);
        
        if ($bbbindex === false || !isset($pathparts[$bbbindex + 1])) {
            throw new ValidationException(
                'Missing instance ID in URL',
                'MISSING_INSTANCE_ID'
            );
        }

        $instanceid = $pathparts[$bbbindex + 1];

        // Validate that ID is numeric.
        if (!is_numeric($instanceid) || intval($instanceid) <= 0) {
            throw new ValidationException(
                'Invalid instance ID format. Must be a positive integer.',
                'INVALID_INSTANCE_ID'
            );
        }

        $instanceid = intval($instanceid);

        // Load BigBlueButton instance using existing Moodle function.
        $instance = instance::get_from_instanceid($instanceid);

        if (!$instance) {
            throw new NotFoundException(
                "BigBlueButton activity with ID {$instanceid} not found",
                'INSTANCE_NOT_FOUND'
            );
        }

        // Get course module and course for context.
        $cm = $instance->get_cm();
        $course = $instance->get_course();
        $context = $instance->get_context();

        // Check if user has permission to view this activity.
        // Uses existing Moodle capability system.
        $this->checkCapability('mod/bigbluebuttonbn:view', $context);

        // Get instance data using existing function.
        $instancedata = $instance->get_instance_data();

        // Handle group-specific information if groups are enabled.
        $groupid = null;
        $groupname = null;
        if ($cm->groupmode != NOGROUPS) {
            // Get the current activity group for the user.
            $groupid = groups_get_activity_group($cm, true) ?: null;
            if ($groupid) {
                $group = groups_get_group($groupid);
                if ($group) {
                    $groupname = $group->name;
                }
                // Set group ID on instance for meeting ID generation.
                $instance->set_group_id($groupid);
            }
        }

        // Create meeting object to check status and permissions.
        $meetingobj = new meeting($instance);

        // Determine if user can moderate the meeting.
        $canmoderate = has_capability('mod/bigbluebuttonbn:moderate', $context);

        // Determine if user can join the meeting.
        // Uses existing meeting class method.
        $canjoin = $meetingobj::can_join($instance, $USER->id);

        // Check if meeting is currently running.
        // Delegates to existing meeting status check.
        $meetingrunning = false;
        try {
            $meetingrunning = $meetingobj::is_running($instance);
        } catch (Exception $e) {
            // If unable to check meeting status (e.g., server unavailable),
            // default to false rather than failing the entire request.
            $meetingrunning = false;
        }

        // Get meeting ID for this instance (includes group if applicable).
        $meetingid = $instance->get_meeting_id();

        // Build comprehensive response data structure.
        $data = [
            // Activity instance information.
            'id' => $instancedata->id,
            'name' => $instancedata->name,
            'intro' => $instancedata->intro,
            'introformat' => $instancedata->introformat,
            'type' => $instancedata->type,
            'timecreated' => $instancedata->timecreated,
            'timemodified' => $instancedata->timemodified,

            // Meeting configuration.
            'meetingid' => $meetingid,
            'welcome' => $instancedata->welcome ?? '',
            'maxparticipants' => $instancedata->participants ?? 0,
            'recorded' => (bool)($instancedata->record ?? false),
            
            // Recording settings.
            'recordings_imported' => (bool)($instancedata->recordings_imported ?? false),
            'recordings_preview' => (bool)($instancedata->recordings_preview ?? true),
            
            // Wait settings.
            'wait' => (bool)($instancedata->wait ?? false),
            'userlimit' => $instancedata->userlimit ?? 0,
            
            // Display settings.
            'muteonstart' => (bool)($instancedata->muteonstart ?? false),
            'disablecam' => (bool)($instancedata->disablecam ?? false),
            'disablemic' => (bool)($instancedata->disablemic ?? false),
            'disableprivatechat' => (bool)($instancedata->disableprivatechat ?? false),
            'disablepublicchat' => (bool)($instancedata->disablepublicchat ?? false),
            'disablenote' => (bool)($instancedata->disablenote ?? false),
            'hideuserlist' => (bool)($instancedata->hideuserlist ?? false),
            
            // Lock settings.
            'lockonjoin' => (bool)($instancedata->lockonjoin ?? false),
            'lockonjoinconfigurable' => (bool)($instancedata->lockonjoinconfigurable ?? false),
            
            // Completion settings.
            'completionattendance' => $instancedata->completionattendance ?? 0,
            'completionengagementchats' => $instancedata->completionengagementchats ?? 0,
            'completionengagementtalks' => $instancedata->completionengagementtalks ?? 0,
            'completionengagementraisehand' => $instancedata->completionengagementraisehand ?? 0,
            'completionengagementpollvotes' => $instancedata->completionengagementpollvotes ?? 0,
            'completionengagementemojis' => $instancedata->completionengagementemojis ?? 0,

            // Group information (if applicable).
            'groupid' => $groupid,
            'groupname' => $groupname,

            // Course information.
            'course' => [
                'id' => $course->id,
                'fullname' => $course->fullname,
                'shortname' => $course->shortname,
            ],

            // Course module information.
            'cm' => [
                'id' => $cm->id,
                'groupmode' => $cm->groupmode,
                'groupingid' => $cm->groupingid,
                'visible' => $cm->visible,
            ],

            // User permissions.
            'canModerate' => $canmoderate,
            'canJoin' => $canjoin,

            // Current meeting status.
            'meetingRunning' => $meetingrunning,

            // Additional context.
            'contextid' => $context->id,
        ];

        // Return success response with meeting data.
        $this->success($data);
    }

    /**
     * Handle POST request (not allowed for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException(
            'POST method not supported for BigBlueButton show endpoint. Use GET instead.',
            'METHOD_NOT_ALLOWED'
        );
    }

    /**
     * Handle PUT request (not allowed for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException(
            'PUT method not supported for BigBlueButton show endpoint. Use GET instead.',
            'METHOD_NOT_ALLOWED'
        );
    }

    /**
     * Handle DELETE request (not allowed for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(
            'DELETE method not supported for BigBlueButton show endpoint. Use GET instead.',
            'METHOD_NOT_ALLOWED'
        );
    }
}

// Instantiate and execute the endpoint (skip during testing)
// ApiBase constructor handles JWT validation automatically.
// execute() method routes to appropriate handle_* method.
if (!defined('API_TESTING') && php_sapi_name() !== 'cli') {
    try {
        $endpoint = new BigBlueButtonShowEndpoint();
        $endpoint->execute();
    } catch (Exception $e) {
    // If exception wasn't caught by ApiBase error handling,
    // ensure it's properly logged and returned as JSON.
    if ($e instanceof ApiException) {
        http_response_code($e->getHttpStatus());
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => [
                'code' => $e->getErrorCode(),
                'message' => $e->getMessage(),
            ],
        ]);
    } else {
        // Unexpected exception - return generic server error.
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => [
                'code' => 'SERVER_ERROR',
                'message' => 'An unexpected error occurred',
            ],
        ]);
        // Log the full exception for debugging.
        error_log('BigBlueButton API Error: ' . $e->getMessage());
        error_log($e->getTraceAsString());
    }
    }
}
