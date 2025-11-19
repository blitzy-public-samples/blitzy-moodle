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
 * REST API endpoint for retrieving authenticated user's message conversations.
 *
 * Implements GET /api/v1/messages to list all conversations for the current user
 * with optional filtering by type, favourites status, and read/unread messages.
 * Supports pagination through limitfrom and limitnum parameters.
 *
 * This endpoint is a thin wrapper around \core_message\api::get_conversations(),
 * delegating all business logic to the existing Moodle messaging system without
 * duplication. Critical for React messaging interface enabling users to view
 * their message inbox, see unread counts, filter conversations, and navigate
 * to individual conversation threads through stateless REST API.
 *
 * @package    core_message
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries.
require_once(__DIR__ . '/../../../config.php');
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * REST API endpoint class for retrieving user message conversations.
 *
 * Extends ApiBase to inherit JWT authentication, HTTP method routing,
 * and standardized JSON response formatting. Implements handle_get()
 * to process GET requests for listing conversations with pagination
 * and filtering support.
 *
 * @package    core_message
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class MessagesIndexEndpoint extends ApiBase {

    /**
     * Handle GET requests to retrieve user's message conversations.
     *
     * Validates that messaging is enabled, enforces moodle/site:sendmessage
     * capability, extracts query parameters for pagination and filtering,
     * calls \core_message\api::get_conversations() to retrieve conversation
     * data, and returns standardized JSON response with conversations array
     * and pagination metadata.
     *
     * Query parameters:
     * - limitfrom (int): Pagination offset (default: 0)
     * - limitnum (int): Results per page (default: 20, max: 100)
     * - type (int): Conversation type filter (1=individual, 2=group, 3=self)
     * - favourites (bool): Filter to show only favourite conversations
     * - read (bool): Filter by read/unread status (applied post-retrieval)
     *
     * Response format:
     * {
     *   "success": true,
     *   "data": [
     *     {
     *       "id": 123,
     *       "name": "User Name",
     *       "subname": "Additional info",
     *       "imageurl": "https://...",
     *       "type": 1,
     *       "membercount": 2,
     *       "isfavourite": false,
     *       "isread": true,
     *       "unreadcount": 0,
     *       "ismuted": false,
     *       "members": [...],
     *       "messages": [...],
     *       "cansendmessagetoconversation": true,
     *       "candeletemessagesforallusers": false
     *     }
     *   ],
     *   "meta": {
     *     "pagination": {
     *       "page": 1,
     *       "perPage": 20,
     *       "total": 150,
     *       "totalPages": 8
     *     }
     *   }
     * }
     *
     * @return void Outputs JSON response and exits
     * @throws ApiException If validation fails or user lacks permissions
     */
    protected function handle_get() {
        global $CFG, $USER;

        try {
            // Validate that the messaging system is enabled.
            if (empty($CFG->messaging)) {
                throw new ValidationException('Messaging system is disabled');
            }

            // Get authenticated user from JWT token.
            $user = $this->getUser();
            if (!$user) {
                throw new UnauthorizedException('Authentication required');
            }

            // Enforce messaging permission in system context.
            $systemcontext = context_system::instance();
            $this->checkCapability('moodle/site:sendmessage', $systemcontext);

            // Extract and validate query parameters for pagination.
            $limitfrom = $this->getParam('limitfrom', PARAM_INT, false, 0);
            $limitnum = $this->getParam('limitnum', PARAM_INT, false, 20);

            // Validate pagination parameters.
            if ($limitfrom < 0) {
                throw new ValidationException('Parameter limitfrom must be non-negative');
            }
            if ($limitnum < 1 || $limitnum > 100) {
                throw new ValidationException('Parameter limitnum must be between 1 and 100');
            }

            // Extract optional filter parameters.
            $type = $this->getParam('type', PARAM_INT, false, null);
            $favourites = $this->getParam('favourites', PARAM_BOOL, false, null);
            $read = $this->getParam('read', PARAM_BOOL, false, null);

            // Validate conversation type if provided (1=individual, 2=group, 3=self).
            if ($type !== null && !in_array($type, [1, 2, 3], true)) {
                throw new ValidationException('Parameter type must be 1 (individual), 2 (group), or 3 (self)');
            }

            // Call existing Moodle messaging API to retrieve conversations.
            // This delegates all business logic to core_message without duplication.
            // The mergeself parameter is set to false to exclude self-conversations
            // from the results unless explicitly requested via type filter.
            $conversations = \core_message\api::get_conversations(
                $user->id,
                $limitfrom,
                $limitnum,
                $type,
                $favourites,
                false // mergeself
            );

            // Apply read status filter if requested (post-processing filter).
            // Note: This filtering happens after pagination in the underlying API,
            // which means the returned count may be less than limitnum. This is
            // acceptable as it maintains the thin wrapper pattern without
            // reimplementing the database query logic.
            if ($read !== null && is_array($conversations)) {
                $conversations = array_filter($conversations, function($conv) use ($read) {
                    return isset($conv->isread) && ($conv->isread === $read);
                });
                // Re-index array after filtering to ensure sequential keys.
                $conversations = array_values($conversations);
            }

            // Calculate pagination metadata.
            $page = ($limitfrom > 0) ? (int)floor($limitfrom / $limitnum) + 1 : 1;
            $total = count($conversations);
            
            // Note: Total count and totalPages are based on the current result set.
            // For accurate pagination across all conversations, the frontend should
            // make additional requests until fewer results than limitnum are returned.
            $meta = [
                'pagination' => [
                    'page' => $page,
                    'perPage' => $limitnum,
                    'total' => $total,
                    'totalPages' => ($total > 0) ? (int)ceil($total / $limitnum) : 1
                ]
            ];

            // Return standardized success response with conversations and metadata.
            $this->success($conversations, 200, $meta);

        } catch (moodle_exception $e) {
            // Handle Moodle-specific exceptions (permission denied, invalid parameters, etc.).
            // Convert to appropriate API exception for consistent error responses.
            if (strpos($e->getMessage(), 'nopermission') !== false) {
                throw new ForbiddenException('You do not have permission to view messages');
            } else if (strpos($e->getMessage(), 'disabled') !== false) {
                throw new ValidationException('Messaging system is disabled');
            } else {
                // Generic server error for unexpected Moodle exceptions.
                throw new ServerException('Failed to retrieve conversations: ' . $e->getMessage());
            }
        }
    }

    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for message listing');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for message listing');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for message listing');
    }
}

// Instantiate endpoint and execute request handling.

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new MessagesIndexEndpoint();
    $endpoint->execute();
}
