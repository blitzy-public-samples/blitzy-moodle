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
 * REST API endpoint for retrieving conversation details and message thread.
 *
 * Implements GET /api/v1/messages/conversation/{id} to fetch a single conversation
 * with all messages for the authenticated user. This endpoint provides conversation
 * metadata (name, type, members) along with paginated message history, enabling
 * the React messaging interface to display conversation threads.
 *
 * Key features:
 * - JWT-based authentication via ApiBase parent class
 * - Permission checking using Moodle's capability system (moodle/site:sendmessage)
 * - Conversation membership validation via \core_message\api::is_user_in_conversation()
 * - Delegates to \core_message\api functions without duplicating business logic
 * - Supports pagination via limitfrom/limitnum parameters
 * - Supports incremental message loading via timefrom parameter
 * - Returns conversation metadata with members and chronological messages
 *
 * URL patterns supported:
 * - /api/v1/messages/conversation/{id} - RESTful path parameter
 * - /api/v1/messages/conversation.php?id=123 - Query parameter
 *
 * Request parameters:
 * - id (required): Conversation ID (from URL path or query param)
 * - limitfrom (optional): Starting offset for pagination (default: 0)
 * - limitnum (optional): Number of messages to return (default: 50)
 * - timefrom (optional): Unix timestamp for incremental loading (default: 0)
 *
 * Response structure:
 * {
 *   "success": true,
 *   "data": {
 *     "conversation": {
 *       "id": 123,
 *       "name": "Project Discussion",
 *       "type": 2,
 *       "membercount": 5,
 *       "ismuted": false,
 *       "isfavourite": false,
 *       "isread": true,
 *       "unreadcount": 0
 *     },
 *     "members": [
 *       {
 *         "id": 456,
 *         "fullname": "John Doe",
 *         "profileimageurl": "https://...",
 *         "isonline": true,
 *         "isblocked": false,
 *         "iscontact": true
 *       },
 *       ...
 *     ],
 *     "messages": [
 *       {
 *         "id": 789,
 *         "useridfrom": 456,
 *         "text": "Hello everyone",
 *         "timecreated": 1640000000,
 *         "timeread": 1640001000
 *       },
 *       ...
 *     ]
 *   },
 *   "meta": {
 *     "pagination": {
 *       "page": 1,
 *       "perPage": 50,
 *       "total": 150,
 *       "totalPages": 3
 *     }
 *   }
 * }
 *
 * Error responses:
 * - 400 Bad Request: Invalid conversation ID parameter
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: User lacks moodle/site:sendmessage capability or not conversation member
 * - 404 Not Found: Conversation does not exist
 * - 500 Internal Server Error: Unexpected server-side error
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include Moodle configuration
require_once(__DIR__ . '/../../../config.php');

// Include API base classes
require_once($CFG->dirroot . '/api/lib/api_base.php');
require_once($CFG->dirroot . '/api/lib/api_exception.php');

/**
 * Conversation endpoint class for retrieving conversation details and messages.
 *
 * This endpoint extends ApiBase to handle GET requests for conversation data.
 * It validates user permissions, checks conversation membership, and delegates
 * to Moodle's core_message\api functions for all business logic. The endpoint
 * returns comprehensive conversation data including metadata, members, and
 * paginated message history suitable for React frontend consumption.
 *
 * Security features:
 * - JWT authentication enforced by ApiBase parent class
 * - Capability checking for moodle/site:sendmessage in system context
 * - Conversation membership verification before returning any data
 * - Input validation for all parameters (conversationid, pagination params)
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class ConversationEndpoint extends ApiBase {
    
    /**
     * Handle GET requests to retrieve conversation details and messages.
     *
     * This method implements the core logic for the conversation retrieval endpoint.
     * It performs the following operations in sequence:
     * 1. Extracts conversation ID from URL path or query parameter
     * 2. Validates conversation ID is a valid positive integer
     * 3. Checks that messaging is enabled in Moodle configuration
     * 4. Enforces moodle/site:sendmessage capability in system context
     * 5. Verifies authenticated user is a member of the conversation
     * 6. Extracts pagination parameters (limitfrom, limitnum, timefrom)
     * 7. Retrieves conversation metadata via \core_message\api::get_conversation()
     * 8. Retrieves conversation messages via \core_message\api::get_conversation_messages()
     * 9. Formats response data with conversation, members, and messages
     * 10. Calculates pagination metadata based on message count
     * 11. Returns standardized success response with data and meta
     *
     * All business logic is delegated to existing Moodle core_message\api functions.
     * No grade calculations, permission logic, or database queries are duplicated.
     *
     * @return void Outputs JSON response directly via $this->success()
     * @throws ValidationException If conversation ID is invalid or missing
     * @throws ForbiddenException If user lacks capability or not conversation member
     * @throws NotFoundException If conversation does not exist
     * @throws ServerException If unexpected error occurs in Moodle core functions
     */
    protected function handle_get() {
        global $CFG, $USER;
        
        try {
            // Step 1: Extract conversation ID from URL path or query parameter
            $conversationid = null;
            
            // Try to extract from URL path pattern: /messages/conversation/123
            if (isset($this->requestUri) && preg_match('/\/messages\/conversation\/(\d+)/', $this->requestUri, $matches)) {
                $conversationid = (int)$matches[1];
            }
            
            // Fall back to query parameter if not found in path
            if ($conversationid === null || $conversationid === 0) {
                $conversationid = $this->getParam('id', PARAM_INT, null);
            }
            
            // Step 2: Validate conversation ID is provided and valid
            if ($conversationid === null || $conversationid <= 0) {
                throw new ValidationException(
                    'Invalid or missing conversation ID',
                    [
                        'parameter' => 'id',
                        'value' => $conversationid,
                        'reason' => 'Conversation ID must be a positive integer'
                    ]
                );
            }
            
            // Step 3: Check that messaging is enabled
            if (empty($CFG->messaging)) {
                throw new ForbiddenException(
                    'Messaging is disabled on this site',
                    [
                        'feature' => 'messaging',
                        'config' => '$CFG->messaging'
                    ]
                );
            }
            
            // Step 4: Enforce moodle/site:sendmessage capability in system context
            $systemcontext = \context_system::instance();
            $this->checkCapability('moodle/site:sendmessage', $systemcontext);
            
            // Step 5: Verify user is a member of the conversation
            // Use existing Moodle function - do not reimplement membership logic
            $isMember = \core_message\api::is_user_in_conversation($USER->id, $conversationid);
            
            if (!$isMember) {
                throw new ForbiddenException(
                    'You are not a member of this conversation',
                    [
                        'conversationId' => $conversationid,
                        'userId' => $USER->id,
                        'reason' => 'User must be a conversation member to view messages'
                    ]
                );
            }
            
            // Step 6: Extract pagination parameters with defaults
            $limitfrom = $this->getParam('limitfrom', PARAM_INT, 0);
            $limitnum = $this->getParam('limitnum', PARAM_INT, 50);
            $timefrom = $this->getParam('timefrom', PARAM_INT, 0);
            
            // Validate pagination parameters
            if ($limitfrom < 0) {
                $limitfrom = 0;
            }
            if ($limitnum <= 0 || $limitnum > 100) {
                $limitnum = 50; // Cap at 100 messages per request
            }
            if ($timefrom < 0) {
                $timefrom = 0;
            }
            
            // Step 7: Retrieve conversation metadata using existing Moodle function
            // This delegates to core_message\api without duplicating business logic
            $conversation = \core_message\api::get_conversation($USER->id, $conversationid);
            
            // Check if conversation exists (get_conversation returns false if not found)
            if ($conversation === false || empty($conversation)) {
                throw new NotFoundException(
                    'Conversation not found',
                    [
                        'conversationId' => $conversationid,
                        'reason' => 'Conversation does not exist or user has no access'
                    ]
                );
            }
            
            // Step 8: Retrieve conversation messages using existing Moodle function
            // Sort in chronological order (oldest first) for proper thread display
            $sort = 'timecreated ASC';
            $messages = \core_message\api::get_conversation_messages(
                $USER->id,
                $conversationid,
                $limitfrom,
                $limitnum,
                $sort,
                $timefrom
            );
            
            // Step 9: Format response data structure
            // Extract members from conversation object
            $members = [];
            if (isset($conversation->members) && is_array($conversation->members)) {
                $members = $conversation->members;
            }
            
            // Extract core conversation metadata
            $conversationData = [
                'id' => $conversation->id ?? $conversationid,
                'name' => $conversation->name ?? '',
                'type' => $conversation->type ?? 1,
                'membercount' => $conversation->membercount ?? count($members),
                'ismuted' => $conversation->ismuted ?? false,
                'isfavourite' => $conversation->isfavourite ?? false,
                'isread' => $conversation->isread ?? true,
                'unreadcount' => $conversation->unreadcount ?? 0,
            ];
            
            // Format messages array (messages is already an array from get_conversation_messages)
            $messagesArray = [];
            if (is_array($messages)) {
                foreach ($messages as $message) {
                    $messagesArray[] = [
                        'id' => $message->id ?? 0,
                        'useridfrom' => $message->useridfrom ?? 0,
                        'text' => $message->text ?? '',
                        'timecreated' => $message->timecreated ?? 0,
                        'timeread' => $message->timeread ?? null,
                    ];
                }
            }
            
            // Build complete response data
            $responseData = [
                'conversation' => $conversationData,
                'members' => $members,
                'messages' => $messagesArray,
            ];
            
            // Step 10: Calculate pagination metadata
            // Get total message count for pagination (approximate based on returned data)
            $totalMessages = $limitfrom + count($messagesArray);
            
            // If we received fewer than requested, we're at the end
            if (count($messagesArray) < $limitnum) {
                $totalMessages = $limitfrom + count($messagesArray);
            } else {
                // Estimate total (actual count would require additional query)
                $totalMessages = $limitfrom + count($messagesArray) + 1; // At least one more page
            }
            
            $currentPage = floor($limitfrom / $limitnum) + 1;
            $totalPages = ceil($totalMessages / $limitnum);
            
            $paginationMeta = [
                'pagination' => [
                    'page' => $currentPage,
                    'perPage' => $limitnum,
                    'total' => $totalMessages,
                    'totalPages' => $totalPages,
                    'limitfrom' => $limitfrom,
                    'limitnum' => $limitnum,
                ]
            ];
            
            // Step 11: Return success response with data and pagination metadata
            $this->success($responseData, 200, $paginationMeta);
            
        } catch (ValidationException $e) {
            // Re-throw validation exceptions as-is
            throw $e;
        } catch (ForbiddenException $e) {
            // Re-throw forbidden exceptions as-is
            throw $e;
        } catch (NotFoundException $e) {
            // Re-throw not found exceptions as-is
            throw $e;
        } catch (\moodle_exception $e) {
            // Convert Moodle exceptions to API exceptions
            throw new ServerException(
                'Failed to retrieve conversation: ' . $e->getMessage(),
                [
                    'originalError' => $e->getMessage(),
                    'errorCode' => $e->errorcode ?? 'unknown',
                    'module' => $e->module ?? 'core_message'
                ]
            );
        } catch (\Exception $e) {
            // Handle unexpected exceptions
            throw new ServerException(
                'An unexpected error occurred while retrieving the conversation',
                [
                    'originalError' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine()
                ]
            );
        }
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * This endpoint only supports GET requests. POST requests should be
     * directed to the message sending endpoint instead.
     *
     * @return void Throws exception
     * @throws MethodNotAllowedException Always throws - POST not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException(
            'POST method not supported for conversation retrieval',
            [
                'allowedMethods' => ['GET'],
                'suggestion' => 'Use GET to retrieve conversation data'
            ]
        );
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * This endpoint only supports GET requests. PUT requests should be
     * directed to conversation update endpoints if available.
     *
     * @return void Throws exception
     * @throws MethodNotAllowedException Always throws - PUT not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException(
            'PUT method not supported for conversation retrieval',
            [
                'allowedMethods' => ['GET'],
                'suggestion' => 'Use GET to retrieve conversation data'
            ]
        );
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * This endpoint only supports GET requests. DELETE requests should be
     * directed to conversation deletion endpoints if available.
     *
     * @return void Throws exception
     * @throws MethodNotAllowedException Always throws - DELETE not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(
            'DELETE method not supported for conversation retrieval',
            [
                'allowedMethods' => ['GET'],
                'suggestion' => 'Use GET to retrieve conversation data'
            ]
        );
    }
}

// Execute the endpoint
$endpoint = new ConversationEndpoint();
$endpoint->execute();
