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
 * BigBlueButton Meeting Status API Endpoint
 *
 * REST API endpoint that returns real-time BigBlueButton meeting status.
 * Implements GET /api/v1/bigbluebuttonbn/{id}/status by validating JWT token,
 * extracting instance ID from URL, loading BigBlueButton instance via
 * instance::get_from_instanceid(), checking user permissions with
 * require_capability('mod/bigbluebuttonbn:view'), creating meeting object,
 * calling meeting::get_meeting_info() to retrieve current status from BBB server,
 * and returning JSON response with meeting status including running state,
 * participant count, attendee list, start/end times, and moderator/attendee counts.
 *
 * Delegates to existing mod_bigbluebuttonbn\meeting class for all business logic,
 * uses mod_bigbluebuttonbn\instance for activity context, and employs
 * bigbluebutton_proxy for server communication.
 *
 * Returns:
 * - 200 OK with meeting status data
 * - 404 Not Found if instance not found
 * - 403 Forbidden if user lacks permission
 * - 500 Internal Server Error on server errors
 *
 * Critical for React frontend to monitor meeting state, display participant
 * information, and enable/disable join buttons based on meeting availability.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/moodlelib.php');
require_once($CFG->dirroot . '/lib/accesslib.php');

// Load API base class and exceptions
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Import BigBlueButton classes
use mod_bigbluebuttonbn\instance;
use mod_bigbluebuttonbn\meeting;
use mod_bigbluebuttonbn\local\exceptions\server_not_available_exception;

/**
 * BigBlueButton Meeting Status API Endpoint
 *
 * Provides real-time meeting status information by wrapping existing Moodle
 * BigBlueButton functionality. This is a thin wrapper that delegates all
 * business logic to the existing meeting::get_meeting_info() function.
 *
 * Endpoint: GET /api/v1/bigbluebuttonbn/{id}/status
 *
 * URL Parameters:
 * - {id}: BigBlueButton instance ID (numeric)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "running": boolean,           // Whether meeting is currently running
 *     "totalUserCount": integer,    // Total number of users in meeting
 *     "moderatorCount": integer,    // Number of moderators
 *     "attendeeCount": integer,     // Number of regular attendees (participantcount)
 *     "attendees": array,           // Array of attendee objects
 *     "startTime": integer,         // Meeting start time (Unix timestamp)
 *     "endTime": integer|null,      // Meeting end time if ended
 *     "canJoin": boolean            // Whether current user can join
 *   }
 * }
 *
 * Error Responses:
 * - 404: Instance not found
 * - 403: User lacks mod/bigbluebuttonbn:view capability
 * - 500: BBB server unavailable or other server error
 *
 * @package    core
 * @subpackage api
 */
class BigBlueButtonStatusEndpoint extends ApiBase {

    /**
     * Handle GET request to retrieve meeting status.
     *
     * Extracts instance ID from URL path, validates it exists, checks user
     * permissions, retrieves meeting information from BBB server, and returns
     * formatted JSON response.
     *
     * This method follows the thin wrapper pattern - it delegates all business
     * logic to existing Moodle functions:
     * - instance::get_from_instanceid() for loading BBB instance
     * - require_capability() (via checkCapability()) for permission checks
     * - meeting::get_meeting_info() for retrieving meeting status
     *
     * No business logic is duplicated or reimplemented.
     *
     * @return void Outputs JSON response and exits
     * @throws NotFoundException If BBB instance is not found
     * @throws ForbiddenException If user lacks required capability
     * @throws ServerException If BBB server is unavailable or other error occurs
     */
    protected function handle_get() {
        global $CFG;

        // Extract instance ID from URL path
        // URL format: /api/v1/bigbluebuttonbn/{id}/status
        $requesturi = $_SERVER['REQUEST_URI'];
        $urlparts = explode('/', parse_url($requesturi, PHP_URL_PATH));
        
        // Find the instance ID in URL path
        // Expected path segments: [..., 'bigbluebuttonbn', '{id}', 'status']
        $instanceid = null;
        foreach ($urlparts as $index => $part) {
            if ($part === 'bigbluebuttonbn' && isset($urlparts[$index + 1])) {
                $potentialid = $urlparts[$index + 1];
                // Verify it's numeric and not 'status' or other keyword
                if (is_numeric($potentialid) && $potentialid !== 'status') {
                    $instanceid = (int)$potentialid;
                    break;
                }
            }
        }

        // Validate instance ID was found and is valid
        if ($instanceid === null || $instanceid <= 0) {
            throw new ValidationException('Invalid or missing instance ID in URL', [
                'requestUri' => $requesturi,
                'expectedFormat' => '/api/v1/bigbluebuttonbn/{id}/status'
            ]);
        }

        // Load BigBlueButton instance using existing Moodle function
        // This function handles all database queries and validation
        $instance = instance::get_from_instanceid($instanceid);

        // Check if instance exists
        if (!$instance) {
            throw new NotFoundException('BigBlueButton instance not found', [
                'instanceId' => $instanceid
            ]);
        }

        // Check user has permission to view this BigBlueButton activity
        // Uses existing Moodle capability system - no custom permission logic
        $this->checkCapability('mod/bigbluebuttonbn:view', $instance->get_context());

        try {
            // Create meeting object for this instance
            $meeting = new meeting($instance);

            // Retrieve meeting information from BigBlueButton server
            // This calls the existing meeting::get_meeting_info() function which
            // delegates to meeting::do_get_meeting_info() for actual server communication
            $meetinginfo = $meeting->get_meeting_info();

            // Format response data
            // Map the meeting info object properties to our API response format
            $data = [
                'running' => (bool)$meetinginfo->statusrunning,
                'totalUserCount' => (int)$meetinginfo->totalusercount,
                'moderatorCount' => (int)$meetinginfo->moderatorcount,
                'attendeeCount' => (int)$meetinginfo->participantcount,
                'attendees' => $meetinginfo->attendees ?? [],
                'startTime' => isset($meetinginfo->startedat) ? (int)$meetinginfo->startedat : null,
                'endTime' => null, // Meeting info doesn't provide end time while running
                'canJoin' => (bool)$meetinginfo->canjoin
            ];

            // Return successful response using ApiBase::success() method
            $this->success($data);

        } catch (server_not_available_exception $e) {
            // Handle BBB server unavailability
            // This exception is thrown by the BigBlueButton proxy when it cannot
            // communicate with the BBB server
            throw new ServerException(
                'BigBlueButton server is not available',
                [
                    'instanceId' => $instanceid,
                    'error' => $e->getMessage(),
                    'suggestion' => 'Please check BBB server status and try again later'
                ]
            );
        } catch (moodle_exception $e) {
            // Handle other Moodle exceptions
            // These might include database errors, configuration issues, etc.
            throw new ServerException(
                'Error retrieving meeting status: ' . $e->getMessage(),
                [
                    'instanceId' => $instanceid,
                    'errorCode' => $e->errorcode ?? 'unknown',
                    'module' => $e->module ?? 'unknown'
                ]
            );
        } catch (Exception $e) {
            // Handle any other unexpected exceptions
            throw new ServerException(
                'Unexpected error occurred while retrieving meeting status',
                [
                    'instanceId' => $instanceid,
                    'error' => $e->getMessage(),
                    'type' => get_class($e)
                ]
            );
        }
    }

    /**
     * Handle POST request - not supported for this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for meeting status endpoint');
    }

    /**
     * Handle PUT request - not supported for this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for meeting status endpoint');
    }

    /**
     * Handle DELETE request - not supported for this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for meeting status endpoint');
    }
}

// Instantiate and execute the endpoint (skip during testing)
// ApiBase constructor handles JWT validation and user authentication
// ApiBase::execute() method routes to appropriate handle_* method
if (!defined('API_TESTING') && php_sapi_name() !== 'cli') {
    $endpoint = new BigBlueButtonStatusEndpoint();
    $endpoint->execute();
}
