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
 * REST API endpoint for sending messages to conversations or individual users.
 *
 * Implements POST /api/v1/messages for sending messages through the Moodle
 * messaging system. Accepts JSON body with conversationid or touserid, message
 * text, and text format. Extends ApiBase for JWT authentication and validates
 * that messaging is enabled and user has moodle/site:sendmessage capability.
 *
 * Enforces conversation membership and messaging permissions via the core messaging
 * API's can_send_message_to_conversation() method. Delegates to the existing
 * send_message_to_conversation() function for actual message creation without
 * duplicating any business logic.
 *
 * Validates message content including required fields and length limits per the
 * MESSAGE_MAX_LENGTH constant (4096 characters). Formats message text for display
 * and handles both conversation-based and user-based message sending flows.
 *
 * Returns 201 Created with message object containing id, conversationid, useridfrom,
 * text, and timecreated. Critical for React messaging interface enabling users to
 * compose and send messages through stateless REST API with proper validation and
 * permission enforcement.
 *
 * Usage:
 * POST /api/v1/messages
 * Content-Type: application/json
 * Authorization: Bearer <jwt_token>
 * 
 * Body (conversation-based):
 * {
 *   "conversationid": 123,
 *   "text": "Hello, how are you?",
 *   "textformat": 1
 * }
 *
 * Body (user-based alternative):
 * {
 *   "touserid": 456,
 *   "text": "Hello, how are you?",
 *   "textformat": 1
 * }
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 789,
 *     "conversationid": 123,
 *     "useridfrom": 234,
 *     "text": "Hello, how are you?",
 *     "timecreated": 1698765432
 *   }
 * }
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and initialize environment
require_once(__DIR__ . '/../../../config.php');

// Load API base class and exception classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Load Moodle message library for format constants
require_once($CFG->dirroot . '/lib/messagelib.php');

/**
 * Message sending API endpoint class.
 *
 * Extends ApiBase to inherit JWT authentication, HTTP method routing,
 * request handling, and standardized response formatting. Implements
 * handle_post() to process POST requests for sending messages.
 */
class MessageSendEndpoint extends ApiBase {
    
    /**
     * Handle POST requests to send messages.
     *
     * Validates messaging is enabled, enforces capabilities, parses and validates
     * JSON body, checks conversation permissions, and delegates to core messaging
     * API for message creation. Supports both conversation-based and user-based
     * message sending flows.
     *
     * @return void Calls success() to send 201 Created response
     * @throws ValidationException If input validation fails
     * @throws ForbiddenException If user lacks permission
     * @throws NotFoundException If conversation or user not found
     * @throws ServerException If message sending fails
     */
    protected function handle_post() {
        global $CFG, $DB, $USER;
        
        // Get authenticated user from JWT token
        $user = $this->getUser();
        
        // Set global $USER for Moodle functions that depend on it
        $USER = $user;
        
        // Step 1: Validate that messaging is enabled in Moodle configuration
        if (empty($CFG->messaging)) {
            throw new ValidationException('Messaging is disabled on this site', [
                'feature' => 'messaging',
                'config' => '$CFG->messaging',
                'reason' => 'The messaging feature must be enabled in site administration'
            ]);
        }
        
        // Step 2: Enforce moodle/site:sendmessage capability in system context
        $systemcontext = context_system::instance();
        $this->checkCapability('moodle/site:sendmessage', $systemcontext);
        
        // Step 3: Parse and validate JSON request body
        $data = $this->getJsonBody();
        
        // Determine which flow: conversation-based or user-based
        $conversationid = isset($data['conversationid']) ? $data['conversationid'] : null;
        $touserid = isset($data['touserid']) ? $data['touserid'] : null;
        
        // Validate that either conversationid or touserid is provided (but not both)
        if (!$conversationid && !$touserid) {
            throw new ValidationException('Either conversationid or touserid is required', [
                'field' => 'conversationid or touserid',
                'reason' => 'Must provide either conversationid or touserid to send message'
            ]);
        }
        
        if ($conversationid && $touserid) {
            throw new ValidationException('Cannot specify both conversationid and touserid', [
                'fields' => ['conversationid', 'touserid'],
                'reason' => 'Provide only one of conversationid or touserid, not both'
            ]);
        }
        
        // Step 4: Validate required field - text
        if (!isset($data['text']) || trim($data['text']) === '') {
            throw new ValidationException('Message text is required', [
                'field' => 'text',
                'reason' => 'Message text cannot be empty'
            ]);
        }
        
        $text = trim($data['text']);
        
        // Step 5: Validate message length against MESSAGE_MAX_LENGTH constant
        // The constant is defined in the \core_message\api class
        $maxLength = \core_message\api::MESSAGE_MAX_LENGTH;
        
        if (strlen($text) > $maxLength) {
            throw new ValidationException('Message text exceeds maximum length', [
                'field' => 'text',
                'maxLength' => $maxLength,
                'actualLength' => strlen($text),
                'reason' => "Message text cannot exceed {$maxLength} characters"
            ]);
        }
        
        // Step 6: Get text format (default to FORMAT_PLAIN if not specified)
        $textformat = isset($data['textformat']) ? (int)$data['textformat'] : FORMAT_PLAIN;
        
        // Validate text format is a valid format constant
        $validFormats = [FORMAT_MOODLE, FORMAT_HTML, FORMAT_PLAIN, FORMAT_MARKDOWN];
        if (!in_array($textformat, $validFormats)) {
            throw new ValidationException('Invalid text format', [
                'field' => 'textformat',
                'value' => $textformat,
                'validFormats' => $validFormats,
                'reason' => 'Text format must be one of: ' . implode(', ', $validFormats)
            ]);
        }
        
        // Step 7: Handle alternative flow - sending to user ID
        // If touserid is provided, find or verify conversation exists between users
        if ($touserid) {
            // Validate touserid is a valid integer
            $touserid = (int)$touserid;
            if ($touserid <= 0) {
                throw new ValidationException('Invalid user ID', [
                    'field' => 'touserid',
                    'value' => $touserid,
                    'reason' => 'User ID must be a positive integer'
                ]);
            }
            
            // Check that target user exists
            if (!$DB->record_exists('user', ['id' => $touserid, 'deleted' => 0])) {
                throw new NotFoundException('Target user not found', [
                    'field' => 'touserid',
                    'value' => $touserid,
                    'reason' => 'The specified user does not exist or has been deleted'
                ]);
            }
            
            // Get conversation between current user and target user
            // This function returns conversation ID or false if no conversation exists
            $conversationid = \core_message\api::get_conversation_between_users([$user->id, $touserid]);
            
            if (!$conversationid) {
                // No existing conversation - create one
                // Use create_conversation to create individual conversation
                $conversation = \core_message\api::create_conversation(
                    \core_message\api::MESSAGE_CONVERSATION_TYPE_INDIVIDUAL,
                    [$user->id, $touserid],
                    null, // No name for individual conversations
                    \core_message\api::MESSAGE_CONVERSATION_ENABLED
                );
                $conversationid = $conversation->id;
            }
        }
        
        // Step 8: Validate conversationid is a valid integer
        $conversationid = (int)$conversationid;
        if ($conversationid <= 0) {
            throw new ValidationException('Invalid conversation ID', [
                'field' => 'conversationid',
                'value' => $conversationid,
                'reason' => 'Conversation ID must be a positive integer'
            ]);
        }
        
        // Step 9: Verify conversation exists
        if (!$DB->record_exists('message_conversations', ['id' => $conversationid])) {
            throw new NotFoundException('Conversation not found', [
                'field' => 'conversationid',
                'value' => $conversationid,
                'reason' => 'The specified conversation does not exist'
            ]);
        }
        
        // Step 10: Validate user has permission to send message to this conversation
        // This function checks:
        // - User has moodle/site:sendmessage capability
        // - User is a member of the conversation
        // - For individual conversations, checks privacy settings via can_contact_user()
        try {
            $canSend = \core_message\api::can_send_message_to_conversation($user->id, $conversationid);
            
            if (!$canSend) {
                throw new ForbiddenException('You do not have permission to send messages to this conversation', [
                    'conversationid' => $conversationid,
                    'userid' => $user->id,
                    'reason' => 'User is not a member of the conversation or does not have messaging permissions'
                ]);
            }
        } catch (moodle_exception $e) {
            // Convert Moodle exception to appropriate API exception
            if ($e->errorcode === 'invalidrecord' || strpos($e->getMessage(), 'not found') !== false) {
                throw new NotFoundException('Conversation not found', [
                    'conversationid' => $conversationid,
                    'originalError' => $e->getMessage()
                ]);
            } else {
                throw new ForbiddenException('Permission check failed: ' . $e->getMessage(), [
                    'conversationid' => $conversationid,
                    'userid' => $user->id,
                    'errorcode' => $e->errorcode,
                    'originalError' => $e->getMessage()
                ]);
            }
        }
        
        // Step 11: Delegate to existing Moodle function to send the message
        // This function handles all the business logic:
        // - Creates event data
        // - Sends to all conversation members
        // - Triggers events
        // - Handles notifications
        // - Returns message object with id, useridfrom, text, timecreated
        try {
            $message = \core_message\api::send_message_to_conversation(
                $user->id,
                $conversationid,
                $text,
                $textformat
            );
            
        } catch (moodle_exception $e) {
            // Handle message sending failures
            if (strpos($e->getMessage(), 'cannot send') !== false) {
                throw new ForbiddenException('Failed to send message: ' . $e->getMessage(), [
                    'conversationid' => $conversationid,
                    'userid' => $user->id,
                    'errorcode' => $e->errorcode,
                    'originalError' => $e->getMessage()
                ]);
            } else if (strpos($e->getMessage(), 'undelivered') !== false) {
                throw new ServerException('Message could not be delivered', [
                    'conversationid' => $conversationid,
                    'userid' => $user->id,
                    'errorcode' => $e->errorcode,
                    'originalError' => $e->getMessage(),
                    'reason' => 'Message sending failed due to notification settings or system error'
                ]);
            } else {
                throw new ServerException('Failed to send message: ' . $e->getMessage(), [
                    'conversationid' => $conversationid,
                    'userid' => $user->id,
                    'errorcode' => $e->errorcode,
                    'originalError' => $e->getMessage()
                ]);
            }
        }
        
        // Step 12: Format the response with message details
        // The send_message_to_conversation function returns a message object with:
        // - id: message ID
        // - useridfrom: sender user ID
        // - text: message text (fullmessage field)
        // - timecreated: timestamp
        // - fullmessagetrust: whether message is trusted (HTML allowed)
        
        $responseData = [
            'id' => (int)$message->id,
            'conversationid' => (int)$conversationid,
            'useridfrom' => (int)$message->useridfrom,
            'text' => $message->text,
            'timecreated' => (int)$message->timecreated,
        ];
        
        // Add optional fullmessagetrust if present
        if (isset($message->fullmessagetrust)) {
            $responseData['fullmessagetrust'] = (bool)$message->fullmessagetrust;
        }
        
        // Step 13: Return 201 Created response with message object
        $this->success($responseData, 201);
    }
    
    /**
     * Handle GET requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method is not supported for message sending', [
            'allowedMethods' => ['POST'],
            'reason' => 'Use POST /api/v1/messages to send messages'
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for message sending', [
            'allowedMethods' => ['POST'],
            'reason' => 'Use POST /api/v1/messages to send messages'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for this endpoint', [
            'allowedMethods' => ['POST'],
            'reason' => 'Use POST /api/v1/messages to send messages'
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new MessageSendEndpoint();
$endpoint->execute();
