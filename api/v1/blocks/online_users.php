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
 * REST API endpoint for online users block widget data.
 *
 * Handles GET /api/v1/blocks/online to return online users widget data for
 * React dashboard. Wraps block_online_users\fetcher class to fetch users
 * currently online within configured time window (typically 5 minutes).
 *
 * Accepts optional query parameters:
 * - courseid: Filter online users to specific course context
 * - groupid: Filter by group membership
 * - limit: Maximum number of users to return (default 50)
 *
 * Returns JSON array of user objects with id, name, profile image, last access
 * time, and online status. Enforces block/online_users:viewlist capability
 * check in appropriate context (course or system). Respects user privacy
 * preference for online status hiding.
 *
 * Uses existing online users fetcher logic with zero business logic duplication.
 * Critical for dashboard OnlineUsersWidget component showing real-time presence
 * information for collaboration and community awareness.
 *
 * @package    api
 * @subpackage blocks
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class
require_once(__DIR__ . '/../../lib/api_base.php');

// Load Moodle core libraries for context and user operations
require_once($CFG->dirroot . '/lib/outputlib.php');

// Import online users fetcher class
use block_online_users\fetcher;

/**
 * API endpoint class for online users block widget.
 *
 * Extends ApiBase to provide JWT authentication, capability checking,
 * and standardized response formatting for online users data.
 */
class OnlineUsersApiEndpoint extends ApiBase {
    
    /**
     * Handle GET request for online users data.
     *
     * Retrieves list of users currently online within configured time window.
     * Supports filtering by course and group. Enforces appropriate capability
     * checks and respects privacy preferences.
     *
     * Query parameters:
     * - courseid (int, optional): Course ID for course-specific online users
     * - groupid (int, optional): Group ID to filter by group membership
     * - limit (int, optional): Maximum users to return (default 50, max 200)
     *
     * Response format:
     * {
     *   "success": true,
     *   "data": {
     *     "users": [
     *       {
     *         "id": 123,
     *         "fullname": "John Doe",
     *         "firstname": "John",
     *         "lastname": "Doe",
     *         "profileimageurl": "https://...",
     *         "profileimageurlsmall": "https://...",
     *         "lastaccess": 1703001234,
     *         "isonline": true
     *       }
     *     ],
     *     "total": 15,
     *     "timewindow": 300,
     *     "course": {...}
     *   }
     * }
     *
     * @return void Outputs JSON response directly
     * @throws UnauthorizedException If user is not authenticated
     * @throws ForbiddenException If user lacks block/online_users:viewlist capability
     * @throws ValidationException If courseid is invalid
     * @throws NotFoundException If course does not exist
     */
    protected function handle_get() {
        global $CFG, $OUTPUT;
        
        // Ensure user is authenticated
        $user = $this->getUser();
        
        // Extract optional query parameters with validation
        $courseid = $this->getParam('courseid', PARAM_INT, false, null);
        $groupid = $this->getParam('groupid', PARAM_INT, false, null);
        $limit = $this->getParam('limit', PARAM_INT, false, 50);
        
        // Validate and constrain limit (prevent excessive data transfer)
        if ($limit < 1) {
            $limit = 50;
        }
        if ($limit > 200) {
            $limit = 200; // Maximum limit for performance
        }
        
        // Determine context based on courseid parameter
        $context = null;
        $sitelevel = true;
        $courseobj = null;
        
        if ($courseid !== null && $courseid > 0) {
            // Course-specific online users
            try {
                // Validate course exists
                $courseobj = get_course($courseid);
                
                if (!$courseobj || $courseobj->id == 0) {
                    throw new NotFoundException('Course not found', [
                        'courseid' => $courseid,
                        'reason' => 'The specified course does not exist'
                    ]);
                }
                
                // Get course context
                $context = context_course::instance($courseid);
                $sitelevel = false;
                
            } catch (dml_missing_record_exception $e) {
                // Course not found in database
                throw new NotFoundException('Course not found', [
                    'courseid' => $courseid,
                    'error' => $e->getMessage()
                ]);
                
            } catch (Exception $e) {
                // Other errors (e.g., invalid courseid)
                throw new ValidationException('Invalid course ID', [
                    'courseid' => $courseid,
                    'error' => $e->getMessage()
                ]);
            }
        } else {
            // Site-level online users
            $context = context_system::instance();
            $sitelevel = true;
            $courseid = null; // Ensure null for site level
        }
        
        // Check capability to view online users list in determined context
        $this->checkCapability('block/online_users:viewlist', $context);
        
        // Get time window configuration (default 5 minutes = 300 seconds)
        $timetoshowusers = 300; // Default: 5 minutes
        if (isset($CFG->block_online_users_timetosee)) {
            // Configuration is in minutes, convert to seconds
            $timetoshowusers = $CFG->block_online_users_timetosee * 60;
        }
        
        // Get current time
        $now = time();
        
        // Handle group filtering with separate groups mode
        $currentgroup = $groupid;
        
        // If no explicit group specified, check for separate groups mode in course
        if ($courseid && $currentgroup === null) {
            // Calculate if we are in separate groups mode
            $isseparategroups = ($courseobj->groupmode == SEPARATEGROUPS
                                 && $courseobj->groupmodeforce
                                 && !has_capability('moodle/site:accessallgroups', $context));
            
            if ($isseparategroups) {
                // Get the user's current group in this course
                $currentgroup = groups_get_course_group($courseobj, true);
            }
        }
        
        // Create online users fetcher instance with all parameters
        // This delegates all business logic to existing Moodle fetcher class
        $onlineusers = new fetcher(
            $currentgroup,      // Group filter (null for no filtering)
            $now,               // Current timestamp
            $timetoshowusers,   // Time window in seconds
            $context,           // Context for capability checks
            $sitelevel,         // Whether at site level or course level
            $courseid           // Course ID (null for site level)
        );
        
        // Count total online users (respects privacy settings automatically)
        $totalcount = $onlineusers->count_users();
        
        // Retrieve online users (limited to requested/default limit)
        $users = $onlineusers->get_users($limit);
        
        // Transform user objects to array format for JSON response
        $usersarray = [];
        
        if ($users) {
            foreach ($users as $onlineuser) {
                // Get user picture URLs using Moodle's output API
                $userpicture = new user_picture($onlineuser);
                $userpicture->size = 1; // Size 1 = f1 (small: 35x35)
                $profileimageurl = $userpicture->get_url($OUTPUT)->out(false);
                
                $userpicture->size = 0; // Size 0 = f2 (medium: 100x100)
                $profileimageurlmedium = $userpicture->get_url($OUTPUT)->out(false);
                
                // Determine online status (within time window)
                $isonline = ($onlineuser->lastaccess >= ($now - $timetoshowusers));
                
                // Build user data object
                $userdata = [
                    'id' => (int)$onlineuser->id,
                    'fullname' => fullname($onlineuser),
                    'firstname' => $onlineuser->firstname,
                    'lastname' => $onlineuser->lastname,
                    'profileimageurl' => $profileimageurlmedium,
                    'profileimageurlsmall' => $profileimageurl,
                    'lastaccess' => (int)$onlineuser->lastaccess,
                    'isonline' => $isonline
                ];
                
                $usersarray[] = $userdata;
            }
        }
        
        // Build response data
        $responsedata = [
            'users' => $usersarray,
            'total' => $totalcount,
            'timewindow' => $timetoshowusers
        ];
        
        // Include course information if course-specific
        if ($courseobj) {
            $responsedata['course'] = [
                'id' => (int)$courseobj->id,
                'fullname' => $courseobj->fullname,
                'shortname' => $courseobj->shortname
            ];
        }
        
        // Add metadata for pagination/context
        $meta = [
            'limit' => $limit,
            'count' => count($usersarray),
            'sitelevel' => $sitelevel
        ];
        
        if ($currentgroup !== null) {
            $meta['groupid'] = $currentgroup;
        }
        
        // Return success response with user data and metadata
        $this->success($responsedata, 200, $meta);
    }
    
    /**
     * Handle POST request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for online users endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for online users endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for online users endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $api = new OnlineUsersApi();
    $api->execute();
}
