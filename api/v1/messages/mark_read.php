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
 * REST API endpoint for marking messages as read.
 *
 * Implements PUT /api/v1/messages/{id}/read to update message read status
 * for authenticated user. Delegates to \core_message\api::mark_message_as_read()
 * for actual database update without duplicating business logic. Supports both
 * single message marking via URL parameter and bulk marking via JSON body array.
 *
 * Usage examples:
 * - Mark single message: PUT /api/v1/messages/123/read
 * - Bulk marking: PUT /api/v1/messages/mark_read with JSON: {"messageIds": [1,2,3]}
 *
 * Returns success response with updated message object containing timeread timestamp
 * and conversation's updated unread count. Handles edge cases: already-read messages
 * return success, non-existent messages return 404, messages not owned by user return 403.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and exception handling
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Message Mark Read API Endpoint class.
 *
 * Handles PUT requests to mark messages as read for the authenticated user.
 * Validates message ownership, enforces messaging permissions, and delegates
 * to existing Moodle messaging API for read status updates.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class MessageMarkReadEndpoint extends ApiBase {
    
    /**
     * Handle PUT request to mark message(s) as read.
     *
     * Supports two modes:
     * 1. Single message: Extracts message ID from URL path (/messages/{id}/read)
     * 2. Bulk marking: Accepts JSON body with messageIds array for efficiency
     *
     * Validates:
     * - Messaging is enabled on the site
     * - User has moodle/site:sendmessage capability
     * - User is the recipient of the message(s)
     * - Message exists in database
     *
     * @return void Outputs JSON response directly via success() method
     * @throws ForbiddenException If user lacks permission or is not recipient
     * @throws NotFoundException If message doesn't exist
     * @throws ValidationException If message ID is invalid
     * @throws ServerException If messaging API call fails
     */
    protected function handle_put() {
        global $CFG, $DB, $USER;
        
        // Get authenticated user from JWT token (validated by ApiBase constructor)
        $user = $this->getUser();
        
        // Check if messaging is enabled on this site
        if (empty($CFG->messaging)) {
            throw new ForbiddenException(
                'MESSAGING_DISABLED',
                'Messaging is disabled on this site',
                ['feature' => 'messaging', 'status' => 'disabled']
            );
        }
        
        // Enforce messaging permission at system context level
        // moodle/site:sendmessage capability is required for messaging operations
        $systemcontext = \context_system::instance();
        $this->checkCapability('moodle/site:sendmessage', $systemcontext);
        
        // Check if this is a bulk operation by examining JSON body
        $jsonBody = null;
        try {
            $jsonBody = $this->getJsonBody();
        } catch (ValidationException $e) {
            // If Content-Type is not application/json or body is invalid, 
            // it's a single message operation - continue with URL parsing
            $jsonBody = null;
        }
        
        // Handle bulk marking if JSON body contains messageIds array
        if ($jsonBody !== null && isset($jsonBody['messageIds']) && is_array($jsonBody['messageIds'])) {
            $this->handleBulkMarkRead($jsonBody['messageIds'], $user);
            return;
        }
        
        // Extract message ID from URL path or query parameter for single message
        $messageid = $this->extractMessageId();
        
        // Validate message ID is a positive integer
        if (!$messageid || $messageid <= 0) {
            throw new ValidationException(
                'INVALID_MESSAGE_ID',
                'Invalid message ID provided',
                ['messageId' => $messageid, 'expected' => 'positive integer']
            );
        }
        
        // Mark the single message as read and get result
        $result = $this->markMessageAsRead($messageid, $user);
        
        // Return success response with updated message data and unread count
        $this->success($result, 200);
    }
    
    /**
     * Extract message ID from URL path or query parameter.
     *
     * Tries two extraction methods in order:
     * 1. URL path pattern matching: /api/v1/messages/{id}/read
     * 2. Query parameter fallback: ?id=123
     *
     * @return int|null Message ID or null if not found
     */
    private function extractMessageId() {
        // Try to extract from URL path using regex pattern
        // Matches patterns like: /api/v1/messages/123/read
        if (preg_match('/\/messages\/(\d+)\/read/', $this->requestUri, $matches)) {
            return (int)$matches[1];
        }
        
        // Fall back to query parameter extraction
        // Returns null if parameter not provided (not required for bulk operations)
        return $this->getParam('id', PARAM_INT, false, null);
    }
    
    /**
     * Mark a single message as read for the specified user.
     *
     * Performs complete validation workflow:
     * 1. Retrieves message from database
     * 2. Verifies user is the recipient (useridto matches)
     * 3. Checks if already read (returns success without error)
     * 4. Calls \core_message\api::mark_message_as_read() to update status
     * 5. Retrieves updated unread count for the conversation
     *
     * @param int      $messageid Message ID to mark as read
     * @param stdClass $user      Current authenticated user object
     * @return array Response data with message details and unread count
     * @throws NotFoundException If message doesn't exist
     * @throws ForbiddenException If user is not the recipient
     * @throws ServerException If marking read fails
     */
    private function markMessageAsRead($messageid, $user) {
        global $DB;
        
        // Retrieve message record from database
        // Note: Moodle's messaging system stores messages in 'messages' table
        $message = $DB->get_record('messages', ['id' => $messageid]);
        
        if (!$message) {
            throw new NotFoundException(
                'MESSAGE_NOT_FOUND',
                'The specified message does not exist',
                ['messageId' => $messageid]
            );
        }
        
        // Verify user is the recipient of the message
        // Only the recipient (useridto) can mark a message as read
        if ($message->useridto != $user->id) {
            throw new ForbiddenException(
                'NOT_MESSAGE_RECIPIENT',
                'You are not the recipient of this message',
                [
                    'messageId' => $messageid,
                    'recipientId' => $message->useridto,
                    'requestingUserId' => $user->id
                ]
            );
        }
        
        // Check if message is already marked as read by querying message_user_actions
        // A message is considered read if there's a MESSAGE_ACTION_READ entry for this user
        $readaction = $DB->get_record('message_user_actions', [
            'userid' => $user->id,
            'messageid' => $messageid,
            'action' => \core_message\api::MESSAGE_ACTION_READ
        ]);
        
        if ($readaction) {
            // Message is already read - return success without error
            // This is idempotent behavior - marking as read multiple times is safe
            return [
                'success' => true,
                'message' => [
                    'id' => $message->id,
                    'conversationid' => $message->conversationid,
                    'timeread' => $readaction->timecreated,
                    'alreadyRead' => true
                ],
                'unreadCount' => $this->getConversationUnreadCount($message->conversationid, $user->id)
            ];
        }
        
        // Mark message as read using existing Moodle messaging API
        // This function handles:
        // - Inserting record into message_user_actions table
        // - Triggering message_viewed event
        // - Context validation
        try {
            \core_message\api::mark_message_as_read($user->id, $message);
        } catch (\moodle_exception $e) {
            // Convert Moodle exception to API exception for consistent error handling
            throw new ServerException(
                'MARK_READ_FAILED',
                'Failed to mark message as read: ' . $e->getMessage(),
                [
                    'messageId' => $messageid,
                    'userId' => $user->id,
                    'errorCode' => $e->errorcode,
                    'originalError' => $e->getMessage()
                ]
            );
        } catch (\Exception $e) {
            // Handle unexpected exceptions
            throw new ServerException(
                'UNEXPECTED_ERROR',
                'An unexpected error occurred while marking message as read',
                [
                    'messageId' => $messageid,
                    'error' => $e->getMessage()
                ]
            );
        }
        
        // Get the newly created read action record to retrieve timeread
        $readaction = $DB->get_record('message_user_actions', [
            'userid' => $user->id,
            'messageid' => $messageid,
            'action' => \core_message\api::MESSAGE_ACTION_READ
        ]);
        
        // Get updated unread count for the conversation
        $unreadCount = $this->getConversationUnreadCount($message->conversationid, $user->id);
        
        // Return success response with updated message data
        return [
            'success' => true,
            'message' => [
                'id' => $message->id,
                'conversationid' => $message->conversationid,
                'useridfrom' => $message->useridfrom,
                'timeread' => $readaction ? $readaction->timecreated : time(),
                'alreadyRead' => false
            ],
            'unreadCount' => $unreadCount
        ];
    }
    
    /**
     * Handle bulk marking of multiple messages as read.
     *
     * Processes an array of message IDs, marking each as read. Continues
     * processing even if some messages fail, collecting both successes
     * and failures for comprehensive reporting.
     *
     * Returns aggregated results including:
     * - Total marked count
     * - Total failed count
     * - Individual results array
     * - Individual errors array
     *
     * @param array    $messageIds Array of message IDs to mark as read
     * @param stdClass $user       Current authenticated user object
     * @return void Outputs JSON response directly via success() method
     */
    private function handleBulkMarkRead($messageIds, $user) {
        // Validate that messageIds is a non-empty array
        if (!is_array($messageIds) || empty($messageIds)) {
            throw new ValidationException(
                'INVALID_MESSAGE_IDS',
                'messageIds must be a non-empty array',
                ['provided' => $messageIds, 'expected' => 'array of integers']
            );
        }
        
        $results = [];
        $errors = [];
        
        // Process each message ID individually
        // Continue processing even if some fail to maximize successful updates
        foreach ($messageIds as $messageid) {
            // Validate each ID is an integer
            if (!is_numeric($messageid) || $messageid <= 0) {
                $errors[] = [
                    'messageId' => $messageid,
                    'error' => 'Invalid message ID',
                    'code' => 'INVALID_ID'
                ];
                continue;
            }
            
            try {
                // Mark message as read using same validation and logic as single operation
                $result = $this->markMessageAsRead((int)$messageid, $user);
                $results[] = $result;
                
            } catch (NotFoundException $e) {
                // Message doesn't exist - record error but continue
                $errors[] = [
                    'messageId' => $messageid,
                    'error' => $e->getMessage(),
                    'code' => 'NOT_FOUND'
                ];
                
            } catch (ForbiddenException $e) {
                // User is not recipient - record error but continue
                $errors[] = [
                    'messageId' => $messageid,
                    'error' => $e->getMessage(),
                    'code' => 'FORBIDDEN'
                ];
                
            } catch (\Exception $e) {
                // Unexpected error - record error but continue
                $errors[] = [
                    'messageId' => $messageid,
                    'error' => $e->getMessage(),
                    'code' => 'ERROR'
                ];
            }
        }
        
        // Return bulk operation results with summary statistics
        $this->success([
            'success' => true,
            'summary' => [
                'total' => count($messageIds),
                'marked' => count($results),
                'failed' => count($errors)
            ],
            'results' => $results,
            'errors' => $errors
        ], 200);
    }
    
    /**
     * Get unread message count for a specific conversation.
     *
     * Queries the message_user_actions table to count unread messages
     * in the specified conversation for the given user. A message is
     * considered unread if there's no MESSAGE_ACTION_READ entry for it.
     *
     * @param int $conversationid Conversation ID to get unread count for
     * @param int $userid         User ID to get unread count for
     * @return int Unread message count (0 if none or on error)
     */
    private function getConversationUnreadCount($conversationid, $userid) {
        global $DB;
        
        try {
            // Count unread messages in conversation for this user
            // A message is unread if:
            // 1. It's in the specified conversation
            // 2. It's not from the user themselves (useridfrom != userid)
            // 3. There's no MESSAGE_ACTION_READ or MESSAGE_ACTION_DELETED entry
            $sql = "SELECT COUNT(m.id)
                      FROM {messages} m
                INNER JOIN {message_conversations} mc ON mc.id = m.conversationid
                 LEFT JOIN {message_user_actions} mua ON (
                           mua.messageid = m.id 
                           AND mua.userid = :userid 
                           AND (mua.action = :readaction OR mua.action = :deleteaction)
                       )
                     WHERE m.conversationid = :conversationid
                       AND m.useridfrom != :userid2
                       AND mua.id IS NULL";
            
            $params = [
                'conversationid' => $conversationid,
                'userid' => $userid,
                'userid2' => $userid,
                'readaction' => \core_message\api::MESSAGE_ACTION_READ,
                'deleteaction' => \core_message\api::MESSAGE_ACTION_DELETED
            ];
            
            $count = $DB->count_records_sql($sql, $params);
            
            return (int)$count;
            
        } catch (\Exception $e) {
            // If we can't get the count, return 0 rather than failing the request
            // This ensures the mark read operation succeeds even if count retrieval fails
            return 0;
        }
    }
    
    /**
     * Handle GET request - not supported for this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not allowed for mark_read endpoint. Use PUT to mark messages as read.');
    }
    
    /**
     * Handle POST request - not supported for this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not allowed for mark_read endpoint. Use PUT to mark messages as read.');
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed for mark_read endpoint. Use PUT to mark messages as read.');
    }
}

// Execute the endpoint
// Instantiates MessageMarkReadEndpoint which triggers authentication in __construct()
// Then calls execute() which routes to handle_put() for PUT requests
$endpoint = new MessageMarkReadEndpoint();
$endpoint->execute();
