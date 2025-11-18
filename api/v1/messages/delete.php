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
 * REST API endpoint for deleting messages (user-scoped soft deletion).
 *
 * This endpoint implements DELETE /api/v1/messages/{id} to mark a message as deleted
 * for the authenticated user without removing it from other participants' views.
 * Supports both single message deletion via URL parameter and bulk deletion via JSON body.
 *
 * User-Scoped Deletion Pattern:
 * Moodle's messaging system implements user-scoped soft deletion where a message is
 * marked as deleted for the current user only by inserting a record in the
 * message_user_actions table. The message remains visible to other conversation participants.
 * This endpoint preserves this pattern by delegating to \core_message\api::delete_message().
 *
 * Authentication & Authorization:
 * - JWT token authentication via ApiBase (Authorization header)
 * - Requires moodle/site:sendmessage capability in system context
 * - Messaging must be enabled in site configuration ($CFG->messaging)
 * - User must be either the sender or recipient of the message
 *
 * Request Format:
 * Single deletion:
 *   DELETE /api/v1/messages/123
 *   DELETE /api/v1/messages/delete?id=123
 *
 * Bulk deletion:
 *   DELETE /api/v1/messages/delete
 *   Content-Type: application/json
 *   {"messageIds": [123, 456, 789]}
 *
 * Response Format:
 * Success (single): 204 No Content
 * Success (bulk): 200 OK with JSON body containing results
 * Error: Standard API error envelope with appropriate HTTP status code
 *
 * Edge Cases Handled:
 * - Already-deleted messages: Returns success (idempotent operation)
 * - Non-existent messages: Returns 404 Not Found
 * - Unauthorized deletions: Returns 403 Forbidden
 * - Invalid message IDs: Returns 400 Bad Request
 * - Messaging disabled: Returns 403 Forbidden
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * MessageDeleteEndpoint class for handling message deletion requests.
 *
 * This endpoint extends ApiBase to inherit JWT authentication, HTTP method routing,
 * and response formatting. It implements the handle_delete() method to process
 * DELETE requests for message deletion with user-scoped soft deletion semantics.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class MessageDeleteEndpoint extends ApiBase {

    /**
     * Handle DELETE requests for message deletion.
     *
     * This method implements user-scoped soft deletion of messages. It validates the
     * authenticated user, checks messaging is enabled, enforces capability requirements,
     * extracts and validates the message ID, verifies user permissions (sender or recipient),
     * and delegates to Moodle's core messaging API for deletion.
     *
     * Supports both single message deletion and bulk deletion:
     * - Single: Message ID in URL path (/messages/123) or query parameter (?id=123)
     * - Bulk: JSON body with array of message IDs {"messageIds": [123, 456, 789]}
     *
     * Deletion Flow:
     * 1. Authenticate user via JWT token (handled by ApiBase)
     * 2. Verify messaging is enabled in site configuration
     * 3. Check user has moodle/site:sendmessage capability
     * 4. Extract message ID(s) from request
     * 5. For each message:
     *    a. Validate ID is positive integer
     *    b. Retrieve message record from database
     *    c. Verify user is sender or recipient
     *    d. Call \core_message\api::delete_message() for soft deletion
     * 6. Return 204 No Content (single) or 200 OK (bulk)
     *
     * @return void Outputs JSON response and exits
     * @throws UnauthorizedException If JWT token is missing or invalid (handled by ApiBase)
     * @throws ForbiddenException If messaging disabled or capability check fails
     * @throws ValidationException If message ID is invalid or missing
     * @throws NotFoundException If message record not found in database
     * @throws ForbiddenException If user not authorized to delete message
     */
    protected function handle_delete() {
        global $CFG, $DB, $USER;

        // Step 1: Authenticate user (already handled by ApiBase constructor)
        // The getUser() method will throw UnauthorizedException if not authenticated
        $user = $this->getUser();

        // Step 2: Check if messaging is enabled in site configuration
        if (empty($CFG->messaging)) {
            throw new ForbiddenException(
                'Messaging is disabled on this site',
                ['feature' => 'messaging', 'config' => 'CFG->messaging']
            );
        }

        // Step 3: Enforce capability requirement for sending/managing messages
        // Users need moodle/site:sendmessage to interact with messages
        $systemcontext = context_system::instance();
        $this->checkCapability('moodle/site:sendmessage', $systemcontext);

        // Step 4: Determine if this is single or bulk deletion
        $jsonbody = $this->getJsonBody();
        
        if ($jsonbody !== null && isset($jsonbody['messageIds'])) {
            // Bulk deletion mode
            $this->handleBulkDeletion($jsonbody['messageIds'], $user->id);
        } else {
            // Single deletion mode
            $this->handleSingleDeletion($user->id);
        }
    }

    /**
     * Handle deletion of a single message.
     *
     * Extracts message ID from URL path or query parameter, validates it,
     * retrieves the message record, verifies user permissions, and performs
     * the deletion operation.
     *
     * URL patterns supported:
     * - /api/v1/messages/delete/123 (ID in path)
     * - /api/v1/messages/delete?id=123 (ID in query string)
     *
     * @param int $userid The ID of the authenticated user
     * @return void Outputs 204 No Content response
     * @throws ValidationException If message ID is invalid or missing
     * @throws NotFoundException If message not found
     * @throws ForbiddenException If user not authorized to delete
     */
    private function handleSingleDeletion($userid) {
        global $DB;

        // Extract message ID from URL path or query parameter
        $messageid = $this->extractMessageId();

        // Validate message ID is a positive integer
        if (!is_numeric($messageid) || $messageid <= 0) {
            throw new ValidationException(
                'Invalid message ID',
                [
                    'field' => 'id',
                    'value' => $messageid,
                    'rule' => 'Must be a positive integer'
                ]
            );
        }

        $messageid = (int)$messageid;

        // Retrieve message record from database
        $message = $DB->get_record('messages', ['id' => $messageid]);

        if (!$message) {
            throw new NotFoundException(
                'Message not found',
                ['messageId' => $messageid]
            );
        }

        // Verify user is authorized to delete this message
        // User must be either the sender (useridfrom) or recipient (useridto)
        if ($message->useridfrom != $userid && $message->useridto != $userid) {
            throw new ForbiddenException(
                'You do not have permission to delete this message',
                [
                    'messageId' => $messageid,
                    'userId' => $userid,
                    'reason' => 'User is neither sender nor recipient'
                ]
            );
        }

        // Perform user-scoped soft deletion using Moodle's core messaging API
        // This inserts a record into message_user_actions table to mark the message
        // as deleted for this user only, preserving it for other participants
        try {
            \core_message\api::delete_message($userid, $messageid);
        } catch (moodle_exception $e) {
            // Wrap Moodle exceptions in ApiException for consistent error handling
            throw new ApiException(
                500,
                'MESSAGE_DELETION_FAILED',
                'Failed to delete message: ' . $e->getMessage(),
                [
                    'messageId' => $messageid,
                    'originalError' => $e->getMessage(),
                    'errorCode' => $e->errorcode
                ]
            );
        }

        // Return 204 No Content to indicate successful deletion with no response body
        return noContent();
    }

    /**
     * Handle bulk deletion of multiple messages.
     *
     * Processes an array of message IDs, validating and deleting each one.
     * Collects results for both successful and failed deletions to provide
     * comprehensive feedback to the client.
     *
     * Request body format:
     * {
     *   "messageIds": [123, 456, 789]
     * }
     *
     * Response format:
     * {
     *   "success": true,
     *   "data": {
     *     "deleted": [123, 456],
     *     "failed": [
     *       {
     *         "messageId": 789,
     *         "error": "Message not found"
     *       }
     *     ],
     *     "summary": {
     *       "total": 3,
     *       "successful": 2,
     *       "failed": 1
     *     }
     *   }
     * }
     *
     * @param array $messageids Array of message IDs to delete
     * @param int $userid The ID of the authenticated user
     * @return void Outputs JSON response with deletion results
     * @throws ValidationException If messageIds is not an array or is empty
     */
    private function handleBulkDeletion($messageids, $userid) {
        global $DB;

        // Validate input is an array
        if (!is_array($messageids)) {
            throw new ValidationException(
                'messageIds must be an array',
                [
                    'field' => 'messageIds',
                    'type' => gettype($messageids),
                    'rule' => 'Must be an array of integers'
                ]
            );
        }

        // Validate array is not empty
        if (empty($messageids)) {
            throw new ValidationException(
                'messageIds array cannot be empty',
                [
                    'field' => 'messageIds',
                    'rule' => 'Must contain at least one message ID'
                ]
            );
        }

        $deleted = [];
        $failed = [];

        // Process each message ID
        foreach ($messageids as $messageid) {
            // Validate message ID is a positive integer
            if (!is_numeric($messageid) || $messageid <= 0) {
                $failed[] = [
                    'messageId' => $messageid,
                    'error' => 'Invalid message ID format',
                    'reason' => 'Must be a positive integer'
                ];
                continue;
            }

            $messageid = (int)$messageid;

            // Retrieve message record
            $message = $DB->get_record('messages', ['id' => $messageid]);

            if (!$message) {
                $failed[] = [
                    'messageId' => $messageid,
                    'error' => 'Message not found'
                ];
                continue;
            }

            // Verify user is authorized to delete
            if ($message->useridfrom != $userid && $message->useridto != $userid) {
                $failed[] = [
                    'messageId' => $messageid,
                    'error' => 'Permission denied',
                    'reason' => 'User is neither sender nor recipient'
                ];
                continue;
            }

            // Attempt deletion
            try {
                \core_message\api::delete_message($userid, $messageid);
                $deleted[] = $messageid;
            } catch (moodle_exception $e) {
                $failed[] = [
                    'messageId' => $messageid,
                    'error' => 'Deletion failed',
                    'reason' => $e->getMessage()
                ];
            }
        }

        // Prepare summary statistics
        $summary = [
            'total' => count($messageids),
            'successful' => count($deleted),
            'failed' => count($failed)
        ];

        // Return detailed results
        return $this->success([
            'deleted' => $deleted,
            'failed' => $failed,
            'summary' => $summary
        ]);
    }

    /**
     * Extract message ID from URL path or query parameter.
     *
     * Attempts to extract the message ID from multiple sources in order of preference:
     * 1. URL path after /messages/delete/ (e.g., /messages/delete/123)
     * 2. URL path after /messages/ (e.g., /messages/123)
     * 3. Query parameter 'id' (e.g., ?id=123)
     *
     * This flexible approach supports multiple URL patterns for developer convenience
     * while maintaining RESTful principles.
     *
     * @return int|string The extracted message ID
     * @throws ValidationException If no message ID found in request
     */
    private function extractMessageId() {
        // Try extracting from URL path: /api/v1/messages/delete/123
        if (preg_match('#/messages/delete/(\d+)#', $this->requestUri, $matches)) {
            return $matches[1];
        }

        // Try extracting from URL path: /api/v1/messages/123
        if (preg_match('#/messages/(\d+)#', $this->requestUri, $matches)) {
            return $matches[1];
        }

        // Try extracting from query parameter: ?id=123
        $messageid = $this->getParam('id', PARAM_INT);
        if ($messageid !== null) {
            return $messageid;
        }

        // No message ID found in request
        throw new ValidationException(
            'Message ID is required',
            [
                'field' => 'id',
                'rule' => 'Must be provided in URL path or query parameter',
                'examples' => [
                    '/api/v1/messages/123',
                    '/api/v1/messages/delete/123',
                    '/api/v1/messages/delete?id=123'
                ]
            ]
        );
    }
    
    /**
     * Handle GET request - not supported for this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not allowed for delete endpoint. Use DELETE to remove messages.');
    }
    
    /**
     * Handle POST request - not supported for this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not allowed for delete endpoint. Use DELETE to remove messages.');
    }
    
    /**
     * Handle PUT request - not supported for this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not allowed for delete endpoint. Use DELETE to remove messages.');
    }
}

// Initialize and execute the endpoint
$endpoint = new MessageDeleteEndpoint();
