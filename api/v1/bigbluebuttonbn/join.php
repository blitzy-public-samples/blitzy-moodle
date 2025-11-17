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
 * REST API endpoint for generating BigBlueButton meeting join URLs.
 *
 * This endpoint handles POST requests to /api/v1/bigbluebuttonbn/{id}/join
 * and generates personalized join URLs for authenticated users. It delegates
 * all meeting creation and join logic to the existing BigBlueButton plugin
 * classes, ensuring 100% compatibility with existing business rules.
 *
 * The endpoint:
 * - Validates JWT authentication and user permissions
 * - Loads BigBlueButton instance by ID
 * - Checks join capability (mod/bigbluebuttonbn:join)
 * - Determines user role (moderator vs attendee)
 * - Calls meeting::join_meeting() to create meeting if needed and get join URL
 * - Logs join event via logger::log_meeting_joined_event()
 * - Returns JSON response with join URL and meeting status
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and dependencies
// In test environment, config is already loaded by PHPUnit bootstrap or test script
if (!defined('PHPUNIT_TEST') && !defined('API_TEST_MODE')) {
    require_once(__DIR__ . '/../../../config.php');
}
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Import BigBlueButton plugin classes
use mod_bigbluebuttonbn\instance;
use mod_bigbluebuttonbn\meeting;
use mod_bigbluebuttonbn\logger;
use mod_bigbluebuttonbn\local\exceptions\server_not_available_exception;
use mod_bigbluebuttonbn\local\exceptions\meeting_join_exception;

/**
 * BigBlueButton Join Endpoint
 *
 * Handles POST requests to generate join URLs for BigBlueButton meetings.
 * Extends ApiBase to inherit JWT authentication, capability checking, and
 * standardized response formatting.
 *
 * URL Pattern: POST /api/v1/bigbluebuttonbn/{id}/join
 * 
 * Request:
 * - Method: POST
 * - Headers: Authorization: Bearer <jwt_token>
 * - Path Parameter: {id} - BigBlueButton instance ID
 *
 * Response (Success - 200):
 * {
 *   "success": true,
 *   "data": {
 *     "joinUrl": "https://bbb.server.com/join?...",
 *     "role": "moderator|attendee",
 *     "meetingRunning": true,
 *     "participantCount": 5,
 *     "meetingInfo": {
 *       "meetingID": "...",
 *       "meetingName": "...",
 *       "createTime": ...,
 *       "voiceBridge": ...,
 *       "attendeePW": "...",
 *       "moderatorPW": "..."
 *     }
 *   }
 * }
 *
 * Error Responses:
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: User lacks mod/bigbluebuttonbn:join capability
 * - 404 Not Found: BigBlueButton instance not found
 * - 400 Bad Request: Invalid instance ID or meeting cannot be joined
 * - 503 Service Unavailable: BigBlueButton server not available
 * - 500 Internal Server Error: Unexpected server error
 *
 * @package    core
 * @subpackage api
 */
class BigBlueButtonJoinEndpoint extends ApiBase {
    
    /**
     * Handle GET requests.
     *
     * GET method is not supported for this endpoint. Join operations must use POST
     * to ensure idempotency and proper logging of meeting join events.
     *
     * @throws MethodNotAllowedException Always thrown as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not allowed for join endpoint', [
            'allowedMethods' => ['POST'],
            'endpoint' => '/api/v1/bigbluebuttonbn/{id}/join',
            'reason' => 'Join operations must use POST method'
        ]);
    }
    
    /**
     * Handle POST requests to generate BigBlueButton join URL.
     *
     * Main handler for join requests. Implements the following workflow:
     * 1. Extract and validate instance ID from URL path
     * 2. Load BigBlueButton instance from database
     * 3. Check user has join permission
     * 4. Determine user role (moderator or attendee)
     * 5. Call meeting::join_meeting() to create meeting if needed and get join URL
     * 6. Log join event for activity tracking
     * 7. Retrieve updated meeting information
     * 8. Return JSON response with join URL and meeting details
     *
     * All business logic (meeting creation, join URL generation, time validation,
     * participant limits, wait for moderator rules) is delegated to existing
     * plugin classes to ensure 100% compatibility.
     *
     * @throws NotFoundException If instance ID is invalid or instance not found
     * @throws ForbiddenException If user lacks required capabilities
     * @throws ValidationException If meeting cannot be joined (time constraints, full, etc.)
     * @throws ServerException If BigBlueButton server is unavailable
     */
    protected function handle_post() {
        global $DB;
        
        try {
            // Extract instance ID from URL path
            // For URL like /api/v1/bigbluebuttonbn/123/join, extract 123
            $pathParts = explode('/', trim($this->requestUri, '/'));
            
            // Find 'bigbluebuttonbn' in path and get the next segment as ID
            $idIndex = array_search('bigbluebuttonbn', $pathParts);
            if ($idIndex === false || !isset($pathParts[$idIndex + 1])) {
                throw new ValidationException('Missing instance ID in URL path', [
                    'urlPattern' => '/api/v1/bigbluebuttonbn/{id}/join',
                    'receivedPath' => $this->requestUri,
                    'reason' => 'Instance ID must be provided in URL path'
                ]);
            }
            
            $instanceIdStr = $pathParts[$idIndex + 1];
            
            // Validate ID is numeric
            if (!is_numeric($instanceIdStr)) {
                throw new ValidationException('Invalid instance ID format', [
                    'instanceId' => $instanceIdStr,
                    'expectedType' => 'integer',
                    'reason' => 'Instance ID must be a positive integer'
                ]);
            }
            
            $instanceId = (int)$instanceIdStr;
            
            if ($instanceId <= 0) {
                throw new ValidationException('Invalid instance ID value', [
                    'instanceId' => $instanceId,
                    'reason' => 'Instance ID must be a positive integer'
                ]);
            }
            
            // Load BigBlueButton instance from database
            // Uses existing Moodle function - no business logic duplication
            $instance = instance::get_from_instanceid($instanceId);
            
            if ($instance === null) {
                throw new NotFoundException('BigBlueButton activity not found', [
                    'instanceId' => $instanceId,
                    'reason' => 'No BigBlueButton activity exists with this ID'
                ]);
            }
            
            // Get context for capability checking
            $context = $instance->get_context();
            
            // Check user has permission to join meetings
            // Uses existing Moodle capability system - no permission logic duplication
            $this->checkCapability('mod/bigbluebuttonbn:join', $context);
            
            // Get authenticated user
            $user = $this->getUser();
            
            // Determine user role (moderator or attendee)
            // Moderators have additional capabilities like ending meetings
            $isModerator = has_capability('mod/bigbluebuttonbn:moderate', $context, $user->id);
            $role = $isModerator ? 'moderator' : 'attendee';
            
            // Generate join URL and create meeting if needed
            // Delegates ALL meeting logic to existing plugin class:
            // - Checks if meeting is already running
            // - Creates meeting on BBB server if not running
            // - Validates time constraints (openingtime, closingtime)
            // - Checks participant limits
            // - Generates personalized join URL with user credentials
            // - Handles "wait for moderator" settings
            // Uses logger::ORIGIN_BASE to indicate API origin
            $joinUrl = meeting::join_meeting($instance, logger::ORIGIN_BASE);
            
            // Log meeting join event for activity tracking and completion
            // Uses existing logger to maintain consistency with PHP interface
            logger::log_meeting_joined_event($instance, logger::ORIGIN_BASE);
            
            // Retrieve updated meeting information
            // This includes participant count, meeting status, and configuration
            // Parameter true forces cache refresh to get current state
            $meetingInfo = meeting::get_meeting_info_for_instance($instance, true);
            
            // Determine if meeting is currently running
            $meetingRunning = false;
            $participantCount = 0;
            
            if ($meetingInfo && is_array($meetingInfo)) {
                $meetingRunning = isset($meetingInfo['running']) ? (bool)$meetingInfo['running'] : false;
                $participantCount = isset($meetingInfo['participantCount']) ? (int)$meetingInfo['participantCount'] : 0;
            }
            
            // Build response data
            $responseData = [
                'joinUrl' => $joinUrl,
                'role' => $role,
                'meetingRunning' => $meetingRunning,
                'participantCount' => $participantCount,
            ];
            
            // Include detailed meeting info if available
            if ($meetingInfo && is_array($meetingInfo)) {
                $responseData['meetingInfo'] = [
                    'meetingID' => $meetingInfo['meetingID'] ?? '',
                    'meetingName' => $meetingInfo['meetingName'] ?? '',
                    'createTime' => $meetingInfo['createTime'] ?? null,
                    'voiceBridge' => $meetingInfo['voiceBridge'] ?? null,
                    'attendeePW' => $meetingInfo['attendeePW'] ?? '',
                    'moderatorPW' => $meetingInfo['moderatorPW'] ?? '',
                    'hasBeenForciblyEnded' => isset($meetingInfo['hasBeenForciblyEnded']) ? 
                        (bool)$meetingInfo['hasBeenForciblyEnded'] : false,
                    'startTime' => $meetingInfo['startTime'] ?? null,
                    'endTime' => $meetingInfo['endTime'] ?? null,
                ];
            }
            
            // Return success response with join URL and meeting details
            $this->success($responseData, 200);
            
        } catch (server_not_available_exception $e) {
            // BigBlueButton server is not available or not responding
            // Map to 503 Service Unavailable to indicate temporary condition
            throw new ServerException('BigBlueButton server is currently unavailable', [
                'reason' => 'Cannot connect to BigBlueButton server',
                'suggestion' => 'Please try again in a few moments',
                'originalError' => $e->getMessage(),
                'httpStatus' => 503
            ]);
            
        } catch (meeting_join_exception $e) {
            // Meeting cannot be joined due to business rules
            // Examples: waiting for moderator, meeting full, outside scheduled time
            throw new ValidationException($e->getMessage(), [
                'reason' => 'Meeting cannot be joined at this time',
                'originalError' => $e->getMessage(),
                'suggestion' => 'Check meeting schedule and participant limits'
            ]);
            
        } catch (NotFoundException $e) {
            // Re-throw NotFoundException (instance not found)
            throw $e;
            
        } catch (ForbiddenException $e) {
            // Re-throw ForbiddenException (permission denied)
            throw $e;
            
        } catch (ValidationException $e) {
            // Re-throw ValidationException (invalid input)
            throw $e;
            
        } catch (ApiException $e) {
            // Re-throw any other API exceptions
            throw $e;
            
        } catch (Exception $e) {
            // Catch unexpected errors and wrap in ServerException
            throw new ServerException('Failed to generate join URL', [
                'originalError' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'reason' => 'An unexpected error occurred while processing the join request'
            ]);
        }
    }
    
    /**
     * Handle PUT requests.
     *
     * PUT method is not supported for this endpoint. Join operations are
     * idempotent POST operations, not resource updates.
     *
     * @throws MethodNotAllowedException Always thrown as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not allowed for join endpoint', [
            'allowedMethods' => ['POST'],
            'endpoint' => '/api/v1/bigbluebuttonbn/{id}/join',
            'reason' => 'Join operations must use POST method'
        ]);
    }
    
    /**
     * Handle DELETE requests.
     *
     * DELETE method is not supported for this endpoint. Use separate
     * endpoints for ending meetings or removing participants.
     *
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed for join endpoint', [
            'allowedMethods' => ['POST'],
            'endpoint' => '/api/v1/bigbluebuttonbn/{id}/join',
            'reason' => 'Use separate endpoint to end meetings'
        ]);
    }
}

// Instantiate and execute the endpoint (skip during testing)
if (!defined('API_TESTING') && php_sapi_name() !== 'cli') {
    // Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new BigBlueButtonJoinEndpoint();
    $endpoint->execute();
}
}
