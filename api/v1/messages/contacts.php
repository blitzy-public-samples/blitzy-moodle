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
 * REST API endpoint for retrieving user's contacts list.
 *
 * Implements GET /api/v1/messages/contacts to list all contacts for authenticated
 * user with pagination, search, and filtering support. Returns contacts array with
 * user information, unread message counts, online status, profile images, and
 * conversation IDs for direct messaging.
 *
 * Endpoint features:
 * - JWT authentication required
 * - Validates messaging system is enabled
 * - Enforces moodle/site:sendmessage capability
 * - Supports pagination via limitfrom/limitnum parameters
 * - Supports search filtering by contact name
 * - Supports includeblocked parameter to include/exclude blocked users
 * - Enriches contact data with unread counts and online status
 * - Returns conversation IDs for initiating conversations
 *
 * Query parameters:
 * - limitfrom (int, optional): Starting offset for pagination (default: 0)
 * - limitnum (int, optional): Number of records per page (default: 20)
 * - search (string, optional): Filter contacts by name
 * - includeblocked (bool, optional): Include blocked users in results (default: false)
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 123,
 *       "fullname": "John Doe",
 *       "profileurl": "https://moodle.example.com/user/profile.php?id=123",
 *       "profileimageurl": "https://moodle.example.com/pluginfile.php/...",
 *       "profileimageurlsmall": "https://moodle.example.com/pluginfile.php/...",
 *       "isonline": true,
 *       "showonlinestatus": true,
 *       "iscontact": true,
 *       "isblocked": false,
 *       "isdeleted": false,
 *       "conversationid": 456,
 *       "unreadcount": 3
 *     }
 *   ],
 *   "meta": {
 *     "pagination": {
 *       "page": 1,
 *       "perPage": 20,
 *       "total": 50,
 *       "totalPages": 3
 *     }
 *   }
 * }
 *
 * @package    api
 * @subpackage messages
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/moodlelib.php');
require_once($CFG->dirroot . '/message/lib.php');

// Load API base class and utilities
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * Contacts endpoint for retrieving user's contacts list.
 *
 * Extends ApiBase to inherit JWT authentication, capability checking,
 * parameter extraction, and response formatting. Delegates to existing
 * Moodle messaging functions without duplicating business logic.
 */
class ContactsEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve user's contacts.
     *
     * Validates user authentication and permissions, retrieves contacts using
     * existing Moodle messaging API functions, enriches contact data with
     * unread message counts and conversation IDs, and returns paginated results.
     *
     * @return void Outputs JSON response
     * @throws UnauthorizedException If user is not authenticated
     * @throws ForbiddenException If user lacks required capability
     * @throws BadRequestException If messaging is disabled
     * @throws ServerException If an unexpected error occurs
     */
    protected function handle_get() {
        global $CFG, $DB;
        
        // Validate user is authenticated
        $user = $this->getUser();
        
        // Check if messaging system is enabled
        if (empty($CFG->messaging)) {
            throw new BadRequestException('Messaging is disabled on this site', [
                'feature' => 'messaging',
                'config' => '$CFG->messaging'
            ]);
        }
        
        // Enforce moodle/site:sendmessage capability in system context
        $systemcontext = context_system::instance();
        $this->checkCapability('moodle/site:sendmessage', $systemcontext);
        
        // Extract query parameters with defaults
        $limitfrom = $this->getParam('limitfrom', PARAM_INT, false, 0);
        $limitnum = $this->getParam('limitnum', PARAM_INT, false, 20);
        $search = $this->getParam('search', PARAM_TEXT, false, '');
        $includeblocked = $this->getParam('includeblocked', PARAM_BOOL, false, false);
        
        // Validate pagination parameters
        if ($limitfrom < 0) {
            $limitfrom = 0;
        }
        if ($limitnum < 1 || $limitnum > 100) {
            $limitnum = 20; // Cap at 100 to prevent excessive queries
        }
        
        try {
            // If search parameter provided, use message_search_users for filtering
            if (!empty($search)) {
                $contacts = $this->searchContacts($user->id, $search, $limitfrom, $limitnum);
                $totalcontacts = $this->countSearchedContacts($user->id, $search);
            } else {
                // Get user's contacts using existing Moodle function
                $contacts = \core_message\api::get_user_contacts($user->id, $limitfrom, $limitnum);
                
                // Get total count for pagination metadata
                $totalcontacts = \core_message\api::count_contacts($user->id);
            }
            
            // Enrich contact data with additional information
            $enrichedcontacts = $this->enrichContactData($user->id, $contacts, $includeblocked);
            
            // Calculate pagination metadata
            $page = ($limitfrom / $limitnum) + 1;
            $totalpages = ceil($totalcontacts / $limitnum);
            
            $pagination = [
                'page' => (int)$page,
                'perPage' => (int)$limitnum,
                'total' => (int)$totalcontacts,
                'totalPages' => (int)$totalpages
            ];
            
            // Return success response with contacts and pagination
            $this->success($enrichedcontacts, 200, ['pagination' => $pagination]);
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to API exceptions
            throw new ServerException('Failed to retrieve contacts: ' . $e->getMessage(), [
                'errorcode' => $e->errorcode,
                'module' => $e->module ?? 'core_message',
                'debuginfo' => $e->debuginfo ?? ''
            ]);
        }
    }
    
    /**
     * Search contacts by name using message_search_users.
     *
     * Filters user's contacts by name search term. Uses Moodle's messaging
     * search functionality to find matching contacts.
     *
     * @param int $userid User ID to get contacts for
     * @param string $search Search term to filter contacts by name
     * @param int $limitfrom Starting offset for pagination
     * @param int $limitnum Number of records to return
     * @return array Array of contact objects
     */
    private function searchContacts($userid, $search, $limitfrom, $limitnum) {
        // Get all user's contacts first
        $allcontacts = \core_message\api::get_user_contacts($userid, 0, 0);
        
        // Filter contacts by search term (case-insensitive)
        $searchlower = core_text::strtolower($search);
        $filteredcontacts = array_filter($allcontacts, function($contact) use ($searchlower) {
            $fullnamelower = core_text::strtolower($contact->fullname);
            return strpos($fullnamelower, $searchlower) !== false;
        });
        
        // Apply pagination to filtered results
        $paginatedcontacts = array_slice($filteredcontacts, $limitfrom, $limitnum);
        
        return $paginatedcontacts;
    }
    
    /**
     * Count contacts matching search term.
     *
     * @param int $userid User ID to count contacts for
     * @param string $search Search term to filter contacts by name
     * @return int Total number of matching contacts
     */
    private function countSearchedContacts($userid, $search) {
        // Get all user's contacts
        $allcontacts = \core_message\api::get_user_contacts($userid, 0, 0);
        
        // Filter by search term
        $searchlower = core_text::strtolower($search);
        $filteredcontacts = array_filter($allcontacts, function($contact) use ($searchlower) {
            $fullnamelower = core_text::strtolower($contact->fullname);
            return strpos($fullnamelower, $searchlower) !== false;
        });
        
        return count($filteredcontacts);
    }
    
    /**
     * Enrich contact data with unread counts and conversation IDs.
     *
     * Adds additional information to each contact including:
     * - Unread message count for their conversation
     * - Conversation ID for direct messaging
     * - Filters out blocked users if includeblocked is false
     *
     * @param int $userid User ID to enrich contacts for
     * @param array $contacts Array of contact objects from get_user_contacts
     * @param bool $includeblocked Whether to include blocked users
     * @return array Array of enriched contact objects
     */
    private function enrichContactData($userid, $contacts, $includeblocked) {
        global $DB;
        
        $enrichedcontacts = [];
        
        foreach ($contacts as $contact) {
            // Skip blocked users if includeblocked is false
            if (!$includeblocked && !empty($contact->isblocked)) {
                continue;
            }
            
            // Skip deleted users
            if (!empty($contact->isdeleted)) {
                continue;
            }
            
            // Get conversation ID between current user and this contact
            $conversationid = \core_message\api::get_conversation_between_users([$userid, $contact->id]);
            
            // Get unread message count for this conversation
            $unreadcount = 0;
            if ($conversationid) {
                $unreadcount = $this->getConversationUnreadCount($userid, $conversationid);
            }
            
            // Build enriched contact object
            $enrichedcontact = [
                'id' => (int)$contact->id,
                'fullname' => $contact->fullname,
                'profileurl' => $contact->profileurl,
                'profileimageurl' => $contact->profileimageurl,
                'profileimageurlsmall' => $contact->profileimageurlsmall,
                'isonline' => $contact->isonline ?? false,
                'showonlinestatus' => $contact->showonlinestatus ?? false,
                'iscontact' => $contact->iscontact ?? true,
                'isblocked' => $contact->isblocked ?? false,
                'isdeleted' => $contact->isdeleted ?? false,
                'conversationid' => $conversationid ? (int)$conversationid : null,
                'unreadcount' => (int)$unreadcount
            ];
            
            $enrichedcontacts[] = $enrichedcontact;
        }
        
        return $enrichedcontacts;
    }
    
    /**
     * Get unread message count for a specific conversation.
     *
     * Counts messages in the conversation that have not been read or deleted
     * by the user. Uses same SQL pattern as Moodle's messaging system.
     *
     * @param int $userid User ID to check unread messages for
     * @param int $conversationid Conversation ID to get unread count for
     * @return int Number of unread messages
     */
    private function getConversationUnreadCount($userid, $conversationid) {
        global $DB;
        
        // Query to count unread messages in conversation
        // A message is unread if:
        // 1. It's in the specified conversation
        // 2. It's not from the user themselves
        // 3. It doesn't have a READ or DELETED action for this user
        $sql = "SELECT COUNT(m.id)
                  FROM {messages} m
            INNER JOIN {message_conversation_members} mcm
                    ON m.conversationid = mcm.conversationid
             LEFT JOIN {message_user_actions} mua
                    ON (mua.messageid = m.id AND mua.userid = :userid1 AND
                        (mua.action = :readaction OR mua.action = :deletedaction))
                 WHERE m.conversationid = :conversationid
                   AND mcm.userid = :userid2
                   AND m.useridfrom != :userid3
                   AND mua.id IS NULL";
        
        $params = [
            'userid1' => $userid,
            'userid2' => $userid,
            'userid3' => $userid,
            'conversationid' => $conversationid,
            'readaction' => \core_message\api::MESSAGE_ACTION_READ,
            'deletedaction' => \core_message\api::MESSAGE_ACTION_DELETED
        ];
        
        return (int)$DB->count_records_sql($sql, $params);
    }
    
    /**
     * Handle POST method - not supported for contacts endpoint.
     *
     * @throws MethodNotAllowedException
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for contacts endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT method - not supported for contacts endpoint.
     *
     * @throws MethodNotAllowedException
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for contacts endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE method - not supported for contacts endpoint.
     *
     * @throws MethodNotAllowedException
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for contacts endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
}

// Instantiate and execute the endpoint

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new ContactsEndpoint();
    $endpoint->execute();
}
