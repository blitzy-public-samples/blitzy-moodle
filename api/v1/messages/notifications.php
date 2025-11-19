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
 * REST API endpoint for retrieving user notifications.
 *
 * Implements GET /api/v1/notifications to list system notifications for the
 * authenticated user with filtering, pagination, and polling support.
 *
 * Features:
 * - Retrieves notifications using existing Moodle message_get_messages() function
 * - Supports filtering by read status (0=unread, 1=read, 2=both)
 * - Supports filtering by component (mod_assign, mod_forum, etc.)
 * - Supports polling via since parameter (timestamp)
 * - Provides unread count for notification badge display
 * - Returns formatted notification objects with context URLs for actions
 * - Enforces moodle/site:sendmessage capability requirement
 * - Delegates all business logic to existing Moodle functions
 *
 * Query Parameters:
 * - limitfrom: Pagination offset (default: 0)
 * - limitnum: Number of notifications to return (default: 20)
 * - read: Filter by read status - 0=unread only, 1=read only, 2=both (default: 2)
 * - component: Filter by notification source component (optional)
 * - since: Unix timestamp to retrieve only notifications created after this time (optional)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "notifications": [
 *       {
 *         "id": 123,
 *         "useridfrom": 45,
 *         "useridto": 12,
 *         "subject": "Assignment graded",
 *         "fullmessage": "Your assignment has been graded...",
 *         "fullmessagehtml": "<p>Your assignment has been graded...</p>",
 *         "fullmessageformat": 1,
 *         "smallmessage": "Assignment graded",
 *         "component": "mod_assign",
 *         "eventtype": "assign_notification",
 *         "contexturl": "https://moodle.site/mod/assign/view.php?id=5",
 *         "contexturlname": "View assignment",
 *         "timecreated": 1700000000,
 *         "timeread": null,
 *         "userfromfullname": "John Doe"
 *       }
 *     ],
 *     "unreadcount": 5
 *   },
 *   "meta": {
 *     "pagination": {
 *       "limitfrom": 0,
 *       "limitnum": 20,
 *       "total": 45,
 *       "hasmore": true
 *     }
 *   }
 * }
 *
 * @package    api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and dependencies
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Load Moodle configuration and libraries (skip in test mode)
if (!defined('API_TEST_MODE')) {
    require_once(__DIR__ . '/../../../config.php');
    global $CFG;
    
    // Load Moodle message library for message_get_messages() and constants
    require_once($CFG->dirroot . '/message/lib.php');
}

/**
 * Notifications endpoint class.
 *
 * Handles retrieval of system notifications for authenticated users.
 * Extends ApiBase to inherit JWT authentication and response formatting.
 */
class NotificationsEndpoint extends ApiBase {
    
    /**
     * Handle GET requests - retrieve notifications for authenticated user.
     *
     * This method:
     * 1. Validates user authentication via JWT token
     * 2. Checks messaging system is enabled (notifications use same system)
     * 3. Enforces moodle/site:sendmessage capability in system context
     * 4. Extracts and validates query parameters
     * 5. Delegates to message_get_messages() to retrieve notifications
     * 6. Enriches notification data with component/eventtype information
     * 7. Calculates total unread notification count
     * 8. Formats and returns success response with notifications and metadata
     *
     * All business logic is delegated to existing Moodle functions.
     * No grade calculations, permission checks, or enrollment logic is reimplemented.
     *
     * @return void Outputs JSON response directly via success() method
     * @throws UnauthorizedException If user is not authenticated
     * @throws ForbiddenException If user lacks required capability
     * @throws moodle_exception If messaging is disabled
     */
    protected function handle_get() {
        global $CFG, $USER, $DB;
        
        try {
            // 1. Get authenticated user from JWT token (inherited from ApiBase)
            $user = $this->getUser();
            
            // Set global $USER for Moodle functions that depend on it
            $USER = $user;
            
            // 2. Check if messaging system is enabled (notifications use the messaging infrastructure)
            if (empty($CFG->messaging)) {
                throw new moodle_exception('disabled', 'message');
            }
            
            // 3. Enforce moodle/site:sendmessage capability in system context
            // This capability controls access to the messaging/notification system
            $systemcontext = context_system::instance();
            $this->checkCapability('moodle/site:sendmessage', $systemcontext);
            
            // 4. Extract query parameters with validation
            
            // Pagination parameters
            $limitfrom = $this->getParam('limitfrom', PARAM_INT, false, 0);
            $limitnum = $this->getParam('limitnum', PARAM_INT, false, 20);
            
            // Ensure non-negative pagination values
            $limitfrom = max(0, $limitfrom);
            $limitnum = max(1, min(100, $limitnum)); // Cap at 100 notifications per request
            
            // Read status filter: 0=unread, 1=read, 2=both
            // Maps to Moodle constants: MESSAGE_GET_UNREAD, MESSAGE_GET_READ, MESSAGE_GET_READ_AND_UNREAD
            $readparam = $this->getParam('read', PARAM_INT, false, 2);
            
            // Map read parameter to Moodle message constants
            switch ($readparam) {
                case 0:
                    $read = MESSAGE_GET_UNREAD; // Constant value: 0
                    break;
                case 1:
                    $read = MESSAGE_GET_READ; // Constant value: 1
                    break;
                case 2:
                default:
                    $read = MESSAGE_GET_READ_AND_UNREAD; // Constant value: 2
                    break;
            }
            
            // Optional component filter (e.g., 'mod_assign', 'mod_forum')
            $component = $this->getParam('component', PARAM_ALPHANUMEXT, false, null);
            
            // Optional timestamp for polling (retrieve only notifications created after this time)
            $since = $this->getParam('since', PARAM_INT, false, null);
            
            // 5. Delegate to existing Moodle function to retrieve notifications
            // message_get_messages($useridto, $useridfrom, $notifications, $read, $sort, $limitfrom, $limitnum)
            // - $useridto: authenticated user ID
            // - $useridfrom: 0 = any sender
            // - $notifications: 1 = retrieve notifications (not messages)
            // - $read: filter by read status
            // - $sort: order by timecreated DESC
            // - $limitfrom, $limitnum: pagination
            
            $sort = 'timecreated DESC'; // Newest first
            $notifications = message_get_messages(
                $user->id,      // useridto: current user
                0,              // useridfrom: any sender (0 = all)
                1,              // notifications: 1 = retrieve notifications, not messages
                $read,          // read status filter
                $sort,          // sort order
                $limitfrom,     // pagination offset
                $limitnum       // pagination limit
            );
            
            // 6. Enrich and filter notification data
            
            $enrichedNotifications = [];
            
            if (!empty($notifications)) {
                foreach ($notifications as $notification) {
                    // Apply component filter if specified
                    if ($component !== null && $notification->component !== $component) {
                        continue; // Skip notifications from other components
                    }
                    
                    // Apply since filter if specified (polling support)
                    if ($since !== null && $notification->timecreated <= $since) {
                        continue; // Skip notifications older than or equal to since timestamp
                    }
                    
                    // Format notification object for API response
                    $enrichedNotification = [
                        'id' => (int)$notification->id,
                        'useridfrom' => (int)$notification->useridfrom,
                        'useridto' => (int)$notification->useridto,
                        'subject' => $notification->subject ?? '',
                        'fullmessage' => $notification->fullmessage ?? '',
                        'fullmessagehtml' => $notification->fullmessagehtml ?? '',
                        'fullmessageformat' => (int)$notification->fullmessageformat,
                        'smallmessage' => $notification->smallmessage ?? '',
                        'component' => $notification->component ?? '',
                        'eventtype' => $notification->eventtype ?? '',
                        'contexturl' => $notification->contexturl ?? '',
                        'contexturlname' => $notification->contexturlname ?? '',
                        'timecreated' => (int)$notification->timecreated,
                        'timeread' => $notification->timeread ? (int)$notification->timeread : null,
                    ];
                    
                    // Include sender's full name if available
                    if (!empty($notification->userfromfullname)) {
                        $enrichedNotification['userfromfullname'] = $notification->userfromfullname;
                    }
                    
                    // Include custom data if present (JSON-encoded additional information)
                    if (!empty($notification->customdata)) {
                        $customdata = json_decode($notification->customdata, true);
                        if (json_last_error() === JSON_ERROR_NONE) {
                            $enrichedNotification['customdata'] = $customdata;
                        }
                    }
                    
                    $enrichedNotifications[] = $enrichedNotification;
                }
            }
            
            // 7. Calculate total unread notification count for badge display
            // Uses direct database query as shown in core_message\external\get_unread_notification_count
            // This provides the count for the notification bell icon in the UI
            
            $unreadcount = $DB->count_records_sql(
                "SELECT COUNT(n.id)
                   FROM {notifications} n
              LEFT JOIN {user} u ON (u.id = n.useridfrom AND u.deleted = 0)
                  WHERE n.useridto = ?
                        AND n.timeread IS NULL",
                [$user->id]
            );
            
            // 8. Calculate total count for pagination metadata
            // For accurate pagination, we need to know if there are more notifications available
            
            // Count total notifications matching the current filters
            $params = [$user->id];
            $whereconditions = ['useridto = ?'];
            
            // Apply read filter to count query
            if ($read === MESSAGE_GET_READ) {
                $whereconditions[] = 'timeread IS NOT NULL';
            } else if ($read === MESSAGE_GET_UNREAD) {
                $whereconditions[] = 'timeread IS NULL';
            }
            // For MESSAGE_GET_READ_AND_UNREAD, no additional filter needed
            
            // Apply component filter to count query if specified
            if ($component !== null) {
                $whereconditions[] = 'component = ?';
                $params[] = $component;
            }
            
            // Apply since filter to count query if specified
            if ($since !== null) {
                $whereconditions[] = 'timecreated > ?';
                $params[] = $since;
            }
            
            $where = implode(' AND ', $whereconditions);
            
            $totalcount = $DB->count_records_sql(
                "SELECT COUNT(id) FROM {notifications} WHERE $where",
                $params
            );
            
            // 9. Format response with notifications array and metadata
            
            $data = [
                'notifications' => $enrichedNotifications,
                'unreadcount' => (int)$unreadcount,
            ];
            
            // Build pagination metadata
            $meta = [
                'pagination' => [
                    'limitfrom' => $limitfrom,
                    'limitnum' => $limitnum,
                    'total' => (int)$totalcount,
                    'hasmore' => ($limitfrom + $limitnum) < $totalcount,
                ],
            ];
            
            // Add filter information to metadata for client reference
            $meta['filters'] = [
                'read' => $readparam,
            ];
            
            if ($component !== null) {
                $meta['filters']['component'] = $component;
            }
            
            if ($since !== null) {
                $meta['filters']['since'] = $since;
            }
            
            // 10. Return success response with data and metadata
            // Delegates to ApiBase::success() which formats as standard JSON envelope
            $this->success($data, 200, $meta);
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to API exceptions
            // ApiBase will catch and format these as proper API error responses
            throw new ApiException(
                $e->errorcode ?? 'error',
                $e->getMessage(),
                400,
                [
                    'module' => $e->module ?? 'moodle',
                    'link' => $e->link ?? '',
                ]
            );
        }
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * Notifications are read-only from the API perspective.
     * Use mark_all_notifications_as_read endpoint to update read status.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for this endpoint', [
            'allowedMethods' => ['GET'],
            'suggestion' => 'Use GET to retrieve notifications'
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for this endpoint', [
            'allowedMethods' => ['GET'],
            'suggestion' => 'Use GET to retrieve notifications'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for this endpoint', [
            'allowedMethods' => ['GET'],
            'suggestion' => 'Use GET to retrieve notifications'
        ]);
    }
}

// Instantiate and execute the endpoint

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new NotificationsEndpoint();
    $endpoint->execute();
}
