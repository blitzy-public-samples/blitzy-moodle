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
 * REST API endpoint for forum subscription management.
 *
 * Implements POST /api/v1/forums/{id}/subscribe to allow authenticated users
 * to subscribe to or unsubscribe from forum notifications. This endpoint acts
 * as a thin wrapper around Moodle's existing forum subscription functions,
 * delegating all business logic to \mod_forum\subscriptions class methods.
 *
 * The endpoint supports both explicit subscription actions via JSON body
 * parameter and toggle behavior when no preference is specified. It enforces
 * proper permission checks and handles edge cases including forced subscription
 * forums and non-subscribable forums.
 *
 * Request format:
 * POST /api/v1/forums/{id}/subscribe
 * Authorization: Bearer <jwt_token>
 * Content-Type: application/json
 * Body: {"subscribe": true}  // true=subscribe, false=unsubscribe, omit=toggle
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "forumId": 5,
 *     "subscribed": true,
 *     "message": "Successfully subscribed to forum"
 *   }
 * }
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include API base class and exception handling
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Include Moodle configuration and forum library
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/forum/lib.php');

// Require forum subscriptions class
require_once($CFG->dirroot . '/mod/forum/classes/subscriptions.php');

/**
 * Forum subscription endpoint class.
 *
 * Handles POST requests to subscribe/unsubscribe users from forum notifications.
 * Extends ApiBase to inherit JWT authentication, HTTP method routing, and response
 * formatting infrastructure. All subscription business logic is delegated to
 * existing Moodle forum subscription functions with zero duplication.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class ForumSubscribeEndpoint extends ApiBase {
    
    /**
     * Handle POST requests for forum subscription management.
     *
     * This method processes subscription requests by:
     * 1. Extracting forum ID from URL path
     * 2. Validating forum exists and user has access permissions
     * 3. Checking if forum allows subscription management
     * 4. Processing subscribe/unsubscribe action via existing Moodle functions
     * 5. Returning subscription status to client
     *
     * The method delegates all permission checks to require_capability() and all
     * subscription logic to \mod_forum\subscriptions class methods, maintaining
     * complete alignment with existing Moodle forum behavior.
     *
     * @return void Outputs JSON response directly via success() or error()
     * @throws ValidationException If forum ID is invalid or URL pattern doesn't match
     * @throws NotFoundException If forum does not exist
     * @throws ForbiddenException If user lacks permission to view forum
     * @throws BadRequestException If forum doesn't support subscription management
     */
    protected function handle_post() {
        global $DB, $USER;
        
        // Get authenticated user from JWT token (validated in ApiBase constructor)
        $user = $this->getUser();
        
        // Extract forum ID from URL path using regex pattern matching
        // Expected pattern: /api/v1/forums/{id}/subscribe
        if (!preg_match('#/forums/(\d+)/subscribe#', $this->requestUri, $matches)) {
            throw new ValidationException(
                'Invalid URL format. Expected: /api/v1/forums/{id}/subscribe',
                ['requestUri' => $this->requestUri]
            );
        }
        
        $forumid = (int)$matches[1];
        
        // Validate forum ID is a positive integer
        if ($forumid <= 0) {
            throw new ValidationException(
                'Invalid forum ID',
                ['forumId' => $forumid, 'reason' => 'Forum ID must be a positive integer']
            );
        }
        
        // Retrieve forum record from database
        $forum = $DB->get_record('forum', ['id' => $forumid], '*', IGNORE_MISSING);
        
        if (!$forum) {
            throw new NotFoundException(
                'Forum not found',
                ['forumId' => $forumid]
            );
        }
        
        // Get course module instance for forum
        $cm = get_coursemodule_from_instance('forum', $forum->id, $forum->course, false, MUST_EXIST);
        
        // Get module context for permission checking
        $context = context_module::instance($cm->id);
        
        // Check user has permission to view forum discussions (enforces existing capability)
        $this->checkCapability('mod/forum:viewdiscussion', $context);
        
        // Check if forum is subscribable (delegates to existing function)
        if (!\mod_forum\subscriptions::is_subscribable($forum)) {
            throw new BadRequestException(
                'This forum does not allow subscription management',
                [
                    'forumId' => $forumid,
                    'reason' => 'Forum subscription is not enabled or forum is forced subscription'
                ]
            );
        }
        
        // Check if forum is force subscribed (users cannot change subscription)
        if (\mod_forum\subscriptions::is_forcesubscribed($forum)) {
            throw new BadRequestException(
                'Cannot modify subscription for this forum',
                [
                    'forumId' => $forumid,
                    'reason' => 'Forum has forced subscription enabled - all users are automatically subscribed'
                ]
            );
        }
        
        // Parse JSON body to get subscription preference
        $body = $this->getJsonBody();
        
        // Determine target subscription state
        // If 'subscribe' parameter provided explicitly, use it
        // Otherwise, toggle current subscription status
        $targetSubscribed = null;
        if (isset($body['subscribe'])) {
            // Validate subscribe parameter is boolean
            if (!is_bool($body['subscribe'])) {
                throw new ValidationException(
                    'Invalid subscribe parameter',
                    [
                        'field' => 'subscribe',
                        'value' => $body['subscribe'],
                        'expected' => 'boolean (true or false)'
                    ]
                );
            }
            $targetSubscribed = $body['subscribe'];
        } else {
            // No preference specified - toggle current subscription
            $currentlySubscribed = \mod_forum\subscriptions::is_subscribed($USER->id, $forum, null, $cm);
            $targetSubscribed = !$currentlySubscribed;
        }
        
        // Execute subscription action by delegating to existing Moodle functions
        $message = '';
        $success = false;
        
        try {
            if ($targetSubscribed) {
                // Subscribe user to forum (userrequest=true indicates user-initiated action)
                \mod_forum\subscriptions::subscribe_user($USER->id, $forum, $context, true);
                $message = 'Successfully subscribed to forum';
                $success = true;
            } else {
                // Unsubscribe user from forum (userrequest=true indicates user-initiated action)
                \mod_forum\subscriptions::unsubscribe_user($USER->id, $forum, $context, true);
                $message = 'Successfully unsubscribed from forum';
                $success = true;
            }
        } catch (moodle_exception $e) {
            // Convert Moodle exception to API exception for consistent error handling
            throw new BadRequestException(
                'Failed to update forum subscription',
                [
                    'forumId' => $forumid,
                    'action' => $targetSubscribed ? 'subscribe' : 'unsubscribe',
                    'error' => $e->getMessage()
                ]
            );
        }
        
        // Verify final subscription status by querying current state
        $finalSubscribed = \mod_forum\subscriptions::is_subscribed($USER->id, $forum, null, $cm);
        
        // Build response data object
        $responseData = new stdClass();
        $responseData->forumId = $forumid;
        $responseData->subscribed = $finalSubscribed;
        $responseData->message = $message;
        $responseData->timestamp = time();
        
        // Return success response with subscription status (200 OK)
        $this->success($responseData, 200);
    }
    
    /**
     * Handle GET requests - not supported for this endpoint.
     *
     * Forum subscription management is a state-changing operation and must use POST.
     * Throws MethodNotAllowedException to indicate GET is not supported.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown for GET requests
     */
    protected function handle_get() {
        throw new MethodNotAllowedException(
            'GET method not allowed for forum subscription',
            ['allowedMethods' => ['POST']]
        );
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * Forum subscription uses POST for both subscribe and unsubscribe actions.
     * Throws MethodNotAllowedException to indicate PUT is not supported.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown for PUT requests
     */
    protected function handle_put() {
        throw new MethodNotAllowedException(
            'PUT method not allowed for forum subscription',
            ['allowedMethods' => ['POST']]
        );
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * Forum subscription uses POST with subscribe=false for unsubscribe actions.
     * Throws MethodNotAllowedException to indicate DELETE is not supported.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown for DELETE requests
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(
            'DELETE method not allowed for forum subscription',
            ['allowedMethods' => ['POST']]
        );
    }
}

// Execute the endpoint
$endpoint = new ForumSubscribeEndpoint();
$endpoint->execute();
