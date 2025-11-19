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
 * REST API endpoint for retrieving forum discussions list.
 *
 * Implements GET /api/v1/forums/{id}/discussions to list all discussions in a forum
 * for an authenticated user. Extends ApiBase for JWT authentication and delegates to
 * forum_get_discussions() for discussion retrieval without duplicating business logic.
 *
 * Key features:
 * - JWT-based authentication via ApiBase
 * - Permission validation using require_capability()
 * - Pagination support (page, perpage parameters)
 * - Sorting support (sortby, sortdirection parameters)
 * - Group filtering support (groupid parameter)
 * - Discussion enrichment with unread counts
 * - User display information for discussion starters
 * - User-specific capabilities (reply, edit, delete)
 * - Pinned status and pin/unpin capabilities
 * - Standard JSON response with pagination metadata
 *
 * Request parameters:
 * - page: Page number for pagination (default: 1)
 * - perpage: Items per page (default: 20)
 * - sortby: Field to sort by (default: 'timemodified')
 * - sortdirection: Sort direction 'ASC' or 'DESC' (default: 'DESC')
 * - groupid: Filter discussions by group ID (default: 0 for all groups)
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "discussions": [
 *       {
 *         "id": 123,
 *         "forum": 45,
 *         "name": "Discussion title",
 *         "firstpost": 789,
 *         "userid": 10,
 *         "groupid": 0,
 *         "assessed": 0,
 *         "timemodified": 1234567890,
 *         "usermodified": 10,
 *         "timestart": 0,
 *         "timeend": 0,
 *         "pinned": 0,
 *         "unreadcount": 5,
 *         "userinfo": {
 *           "fullname": "John Doe",
 *           "profileimageurl": "https://..."
 *         },
 *         "capabilities": {
 *           "can_reply": true,
 *           "can_edit": false,
 *           "can_delete": false,
 *           "can_pin": false
 *         }
 *       }
 *     ]
 *   },
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
 * @package    api
 * @subpackage v1_forums
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and dependencies
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');
require_once(__DIR__ . '/../../lib/api_response.php');

// Load Moodle forum library functions
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    require_once($CFG->dirroot . '/mod/forum/lib.php');
    require_once($CFG->dirroot . '/mod/forum/locallib.php');
}

/**
 * Forum discussions list endpoint implementation.
 *
 * Handles GET requests to retrieve a list of discussions for a specific forum
 * with pagination, sorting, filtering, and enrichment of discussion data with
 * user information, unread counts, and capabilities.
 */
class ForumDiscussionsEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve forum discussions.
     *
     * Extracts forum ID from URL path, validates forum existence and user permissions,
     * retrieves discussions using Moodle's forum_get_discussions() function, enriches
     * each discussion with unread post counts and user display information, and returns
     * formatted response with pagination metadata.
     *
     * URL pattern: /api/v1/forums/{forumid}/discussions
     *
     * @return void Outputs JSON response directly via $this->success()
     * @throws NotFoundException If forum is not found in database
     * @throws ValidationException If forum ID is invalid or parameters are malformed
     * @throws ForbiddenException If user lacks mod/forum:viewdiscussion capability
     * @throws UnauthorizedException If JWT authentication fails
     */
    protected function handle_get() {
        global $DB, $USER, $CFG, $OUTPUT;
        
        // Extract forum ID from URL path using regex pattern /forums/(\d+)/discussions/
        $matches = [];
        if (!preg_match('#/forums/(\d+)/discussions#', $this->requestUri, $matches)) {
            throw new ValidationException('Invalid request URI format', [
                'expected_pattern' => '/api/v1/forums/{id}/discussions',
                'received_uri' => $this->requestUri,
                'reason' => 'Forum ID not found in URL path'
            ]);
        }
        
        $forumid = (int) $matches[1];
        
        // Validate forum ID is a positive integer
        if ($forumid <= 0) {
            throw new ValidationException('Invalid forum ID', [
                'forumid' => $forumid,
                'reason' => 'Forum ID must be a positive integer'
            ]);
        }
        
        // Retrieve forum record from database
        $forum = $DB->get_record('forum', ['id' => $forumid]);
        
        if (!$forum) {
            throw new NotFoundException('Forum not found', [
                'forumid' => $forumid,
                'reason' => 'No forum exists with the specified ID'
            ]);
        }
        
        // Get course module instance for this forum
        $cm = get_coursemodule_from_instance('forum', $forum->id, $forum->course);
        
        if (!$cm) {
            throw new NotFoundException('Course module not found', [
                'forumid' => $forumid,
                'reason' => 'Course module instance not found for forum'
            ]);
        }
        
        // Get module context for permission checking
        $context = context_module::instance($cm->id);
        
        // Check user has capability to view discussions in this forum
        // This will throw ForbiddenException via checkCapability() if user lacks permission
        $this->checkCapability('mod/forum:viewdiscussion', $context);
        
        // Extract query parameters with validation
        $page = $this->getParam('page', PARAM_INT, false, 1);
        $perpage = $this->getParam('perpage', PARAM_INT, false, 20);
        $sortby = $this->getParam('sortby', PARAM_ALPHA, false, 'timemodified');
        $sortdirection = $this->getParam('sortdirection', PARAM_ALPHA, false, 'DESC');
        $groupid = $this->getParam('groupid', PARAM_INT, false, -1);
        
        // Validate pagination parameters
        if ($page < 1) {
            $page = 1;
        }
        
        if ($perpage < 1) {
            $perpage = 20;
        }
        
        // Cap perpage at reasonable maximum to prevent performance issues
        if ($perpage > 100) {
            $perpage = 100;
        }
        
        // Validate sort direction
        $sortdirection = strtoupper($sortdirection);
        if ($sortdirection !== 'ASC' && $sortdirection !== 'DESC') {
            $sortdirection = 'DESC';
        }
        
        // Construct sort order string for forum_get_discussions()
        // Default sorting uses timemodified DESC for most recent first
        $validSortFields = ['timemodified', 'timestart', 'subject', 'userid', 'replies'];
        
        if (!in_array($sortby, $validSortFields)) {
            $sortby = 'timemodified';
        }
        
        // Map API sort field to database column
        $sortcolumn = $sortby;
        if ($sortby === 'subject') {
            $sortcolumn = 'name'; // Forum discussions use 'name' field for subject
        }
        
        $sort = "d.{$sortcolumn} {$sortdirection}";
        
        // Calculate offset for pagination
        // forum_get_discussions expects limitfrom as (page - 1) * perpage
        $limitfrom = ($page - 1) * $perpage;
        
        // Handle group filtering
        // If groupid is specified and groups are enabled for this forum, filter by group
        $groupmode = groups_get_activity_groupmode($cm);
        
        if ($groupmode && $groupid > 0) {
            // Verify user has access to this group
            $course = get_course($cm->course);
            
            if (!groups_group_visible($groupid, $course, $cm)) {
                throw new ForbiddenException('Group not accessible', [
                    'groupid' => $groupid,
                    'reason' => 'User does not have access to the specified group'
                ]);
            }
        }
        
        // Call existing Moodle function to retrieve discussions
        // forum_get_discussions($cm, $sort, $fullpost, $unused, $limit, $userlastmodified, $page, $perpage, $groupid, $updatedsince)
        // Parameters:
        // - $cm: course module object
        // - $sort: SQL sort string
        // - $fullpost: whether to include full post content (true for backwards compatibility)
        // - $unused: deprecated parameter (set to -1)
        // - $limit: deprecated, use $page and $perpage instead (set to -1)
        // - $userlastmodified: whether to include user who last modified (false)
        // - $page: deprecated, now calculated as limitfrom (set to -1)
        // - $perpage: number of discussions per page
        // - $groupid: filter by group ID (-1 for all groups user can access)
        // - $updatedsince: filter by modification time (0 for all)
        $discussions = forum_get_discussions($cm, $sort, true, -1, -1, false, $limitfrom, $perpage, $groupid, 0);
        
        if (!is_array($discussions)) {
            $discussions = [];
        }
        
        // Get total discussion count for pagination metadata
        // forum_get_discussions_count() respects group filtering and permissions
        $totalcount = forum_get_discussions_count($cm);
        
        if ($totalcount === false) {
            $totalcount = 0;
        }
        
        // Get unread post counts for all discussions if forum tracking is enabled
        $unreadcounts = [];
        
        if (forum_tp_can_track_forums($forum) && forum_tp_is_tracked($forum)) {
            // forum_get_discussions_unread returns array of discussionid => unreadcount
            $unreadcounts = forum_get_discussions_unread($cm);
            
            if (!is_array($unreadcounts)) {
                $unreadcounts = [];
            }
        }
        
        // Enrich discussion data with additional information
        $enricheddiscussions = [];
        
        foreach ($discussions as $discussion) {
            // Create enriched discussion object
            $enriched = new stdClass();
            
            // Copy core discussion properties
            $enriched->id = (int) $discussion->id;
            $enriched->forum = (int) $discussion->forum;
            $enriched->name = $discussion->name;
            $enriched->firstpost = (int) $discussion->firstpost;
            $enriched->userid = (int) $discussion->userid;
            $enriched->groupid = (int) $discussion->groupid;
            $enriched->assessed = (int) $discussion->assessed;
            $enriched->timemodified = (int) $discussion->timemodified;
            $enriched->usermodified = (int) $discussion->usermodified;
            $enriched->timestart = (int) $discussion->timestart;
            $enriched->timeend = (int) $discussion->timeend;
            $enriched->pinned = (int) $discussion->pinned;
            
            // Add unread post count for this discussion
            $enriched->unreadcount = isset($unreadcounts[$discussion->id]) ? (int) $unreadcounts[$discussion->id] : 0;
            
            // Get user information for discussion starter
            $discussionuser = $DB->get_record('user', ['id' => $discussion->userid]);
            
            if ($discussionuser) {
                // Use Moodle's user_picture class for profile image URL
                $userpicture = new user_picture($discussionuser);
                $userpicture->size = 35; // Small size for list view
                
                $enriched->userinfo = new stdClass();
                $enriched->userinfo->fullname = fullname($discussionuser);
                $enriched->userinfo->profileimageurl = $userpicture->get_url($OUTPUT)->out(false);
            } else {
                // Fallback if user not found
                $enriched->userinfo = new stdClass();
                $enriched->userinfo->fullname = 'Unknown User';
                $enriched->userinfo->profileimageurl = '';
            }
            
            // Add user-specific capabilities for this discussion
            $enriched->capabilities = new stdClass();
            
            // Check if user can reply to this discussion
            $enriched->capabilities->can_reply = forum_user_can_post($forum, $discussion, $USER, $cm, null, $context);
            
            // Check if user can edit this discussion (must be author or have mod permission)
            $enriched->capabilities->can_edit = (
                ($discussion->userid == $USER->id && has_capability('mod/forum:editanypost', $context)) ||
                has_capability('mod/forum:editanypost', $context)
            );
            
            // Check if user can delete this discussion
            $enriched->capabilities->can_delete = (
                ($discussion->userid == $USER->id && has_capability('mod/forum:deleteownpost', $context)) ||
                has_capability('mod/forum:deleteanypost', $context)
            );
            
            // Check if user can pin/unpin discussions
            $enriched->capabilities->can_pin = has_capability('mod/forum:pindiscussions', $context);
            
            $enricheddiscussions[] = $enriched;
        }
        
        // Format pagination metadata using ApiResponse helper
        $pagination = ApiResponse::formatPagination($page, $perpage, $totalcount);
        
        // Return success response with discussions array and pagination metadata
        $this->success([
            'discussions' => $enricheddiscussions
        ], 200, [
            'pagination' => $pagination
        ]);
    }
    
    /**
     * Handle POST request - not supported for this endpoint.
     *
     * Forum discussions list is read-only. Use separate endpoints for
     * creating discussions (POST /api/v1/forums/{id}/discussions/create).
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not allowed for discussions list endpoint', [
            'allowed_methods' => ['GET'],
            'hint' => 'Use POST /api/v1/forums/{id}/discussions/create to create new discussions'
        ]);
    }
    
    /**
     * Handle PUT request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not allowed for discussions list endpoint', [
            'allowed_methods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed for discussions list endpoint', [
            'allowed_methods' => ['GET']
        ]);
    }
}

// Instantiate and execute endpoint

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new ForumDiscussionsEndpoint();
    $endpoint->execute();
}
