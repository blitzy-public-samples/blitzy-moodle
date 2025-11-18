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
 * Forum Create Discussion REST API Endpoint
 *
 * REST API endpoint for creating new forum discussions with first post.
 * Endpoint: POST /api/v1/forums/{id}/discussions
 *
 * This endpoint enables React frontend to create new discussion threads in forums.
 * It validates authentication, permissions, and input data before delegating to
 * the existing forum_add_discussion() function without duplicating business logic.
 *
 * Request Body (JSON):
 * {
 *   "name": "Discussion subject/title (required, max 255 chars)",
 *   "message": "Discussion message content (required)",
 *   "messageformat": 1,  // Optional: FORMAT_HTML (default), FORMAT_MOODLE, etc.
 *   "groupid": 0,        // Optional: Group ID for group discussions (default: 0)
 *   "pinned": false,     // Optional: Pin discussion (requires mod/forum:pindiscussions)
 *   "timestart": 0,      // Optional: Unix timestamp when discussion becomes visible
 *   "timeend": 0,        // Optional: Unix timestamp when discussion expires
 *   "itemid": 0,         // Optional: Draft file area itemid for attachments
 *   "tags": []           // Optional: Array of tag names for discussion
 * }
 *
 * Success Response (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "discussionid": 123,
 *     "firstpost": 456,
 *     "name": "Discussion Title",
 *     "groupid": 0,
 *     "timestart": 0,
 *     "timeend": 0,
 *     "pinned": 0,
 *     "timemodified": 1234567890
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid input data, malformed JSON
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: User lacks mod/forum:startdiscussion capability
 * - 404 Not Found: Forum does not exist
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API infrastructure
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Load Moodle configuration and libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/forum/lib.php');
require_once($CFG->libdir . '/grouplib.php');

/**
 * Forum Create Discussion API Endpoint Class
 *
 * Handles POST /api/v1/forums/{id}/discussions requests to create new discussions.
 * Extends ApiBase for JWT authentication and standard request handling.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class ForumCreateDiscussionEndpoint extends ApiBase {
    
    /**
     * Handle POST request to create a new forum discussion.
     *
     * Validates authentication, extracts forum ID from URL, checks permissions,
     * validates input data, and delegates to forum_add_discussion() to create
     * the discussion and first post.
     *
     * @return void Outputs JSON response directly via success() method
     * @throws UnauthorizedException If user is not authenticated
     * @throws ValidationException If request data is invalid
     * @throws NotFoundException If forum does not exist
     * @throws ForbiddenException If user lacks required capabilities
     */
    protected function handle_post() {
        global $DB, $USER;
        
        // Get authenticated user from JWT token
        $user = $this->getUser();
        
        // Extract forum ID from URL path using regex pattern
        // Expected URL format: /api/v1/forums/{forumid}/discussions
        if (!preg_match('/forums\/(\d+)\/discussions/', $this->requestUri, $matches)) {
            throw new ValidationException('Invalid forum ID in URL path', [
                'expectedFormat' => '/api/v1/forums/{id}/discussions',
                'receivedUri' => $this->requestUri
            ]);
        }
        
        $forumid = intval($matches[1]);
        
        // Validate forum ID is positive integer
        if ($forumid <= 0) {
            throw new ValidationException('Forum ID must be a positive integer', [
                'forumId' => $forumid,
                'receivedValue' => $matches[1]
            ]);
        }
        
        // Retrieve forum record from database
        $forum = $DB->get_record('forum', ['id' => $forumid]);
        if (!$forum) {
            throw new NotFoundException('Forum not found', [
                'forumId' => $forumid,
                'requestedResource' => 'forum'
            ]);
        }
        
        // Get course record (required for context and validation)
        $course = $DB->get_record('course', ['id' => $forum->course], '*', MUST_EXIST);
        
        // Get course module for context and capability checking
        $cm = get_coursemodule_from_instance('forum', $forum->id, $course->id, false, MUST_EXIST);
        
        // Get module context for permission checking
        $context = context_module::instance($cm->id);
        
        // Check user has permission to start discussions in this forum
        // This enforces the mod/forum:startdiscussion capability using Moodle's
        // existing permission system without duplicating authorization logic
        $this->checkCapability('mod/forum:startdiscussion', $context);
        
        // Get JSON request body with discussion data
        $data = $this->getJsonBody();
        
        // Validate required field: name (discussion subject)
        if (empty($data['name']) || trim($data['name']) === '') {
            throw new ValidationException('Discussion name is required', [
                'field' => 'name',
                'constraint' => 'Cannot be empty',
                'received' => isset($data['name']) ? $data['name'] : null
            ]);
        }
        
        // Validate required field: message (discussion content)
        if (empty($data['message']) || trim($data['message']) === '') {
            throw new ValidationException('Discussion message is required', [
                'field' => 'message',
                'constraint' => 'Cannot be empty',
                'received' => isset($data['message']) ? $data['message'] : null
            ]);
        }
        
        // Validate name length (subject field has 255 character limit in database)
        $name = trim($data['name']);
        if (strlen($name) > 255) {
            throw new ValidationException('Discussion name must be 255 characters or less', [
                'field' => 'name',
                'maxLength' => 255,
                'actualLength' => strlen($name),
                'constraint' => 'Subject field database limit'
            ]);
        }
        
        // Extract optional group ID (default: 0 for all participants)
        $groupid = isset($data['groupid']) ? intval($data['groupid']) : 0;
        
        // Validate group restrictions if group ID is specified
        // Check that user is member of the group and group belongs to course
        if ($groupid > 0) {
            // Get list of groups user can post to in this activity
            $allowedgroups = groups_get_activity_allowed_groups($cm, $user->id);
            
            // Verify user can post to the specified group
            if (!array_key_exists($groupid, $allowedgroups)) {
                throw new ForbiddenException('You do not have permission to post to this group', [
                    'requestedGroupId' => $groupid,
                    'allowedGroupIds' => array_keys($allowedgroups),
                    'capability' => 'group posting permission'
                ]);
            }
        }
        
        // Extract optional pinned flag (default: false)
        $pinned = isset($data['pinned']) ? (bool)$data['pinned'] : false;
        
        // If pinning is requested, verify user has permission to pin discussions
        // This requires the mod/forum:pindiscussions capability
        if ($pinned) {
            $this->checkCapability('mod/forum:pindiscussions', $context);
        }
        
        // Check forum type restrictions
        // Single simple discussion forums only allow one discussion total
        if ($forum->type == 'single') {
            $existingdiscussions = $DB->count_records('forum_discussions', ['forum' => $forumid]);
            if ($existingdiscussions > 0) {
                throw new ValidationException('This forum only allows a single discussion', [
                    'forumType' => 'single',
                    'existingDiscussions' => $existingdiscussions,
                    'constraint' => 'Forum configuration limits to one discussion'
                ]);
            }
        }
        
        // Prepare discussion object for forum_add_discussion()
        // This object structure matches the expected parameters of the existing
        // Moodle function without reimplementing any business logic
        $discussion = new stdClass();
        
        // Required fields for forum_add_discussion()
        $discussion->course = $forum->course;
        $discussion->forum = $forumid;
        $discussion->name = $name;  // Discussion subject
        $discussion->message = $data['message'];  // First post message content
        
        // Optional message format (default: FORMAT_HTML)
        // FORMAT_HTML=1, FORMAT_MOODLE=0, FORMAT_PLAIN=2, FORMAT_MARKDOWN=4
        $discussion->messageformat = isset($data['messageformat']) ? 
            intval($data['messageformat']) : FORMAT_HTML;
        
        // Assessed field (copied from forum settings for grading purposes)
        $discussion->assessed = $forum->assessed;
        
        // Group ID for group discussions (0 = all participants)
        $discussion->groupid = $groupid;
        
        // Draft file area item ID for handling file attachments
        // If provided, files from the draft area will be moved to the post
        $discussion->itemid = isset($data['itemid']) ? intval($data['itemid']) : 0;
        
        // Mail now flag (false = queue for digest, true = send immediately)
        // API posts are queued for digest by default for better performance
        $discussion->mailnow = false;
        
        // Optional time restrictions for visibility
        $discussion->timestart = isset($data['timestart']) ? intval($data['timestart']) : 0;
        $discussion->timeend = isset($data['timeend']) ? intval($data['timeend']) : 0;
        
        // Pinned flag (requires mod/forum:pindiscussions capability, validated above)
        $discussion->pinned = $pinned ? FORUM_DISCUSSION_PINNED : FORUM_DISCUSSION_UNPINNED;
        
        // Message trust flag (required for text processing)
        // For API posts, we trust the content since it comes through authentication
        $discussion->messagetrust = trusttext_trusted($context);
        
        // Store tags for later application (after discussion is created)
        $tags = isset($data['tags']) && is_array($data['tags']) ? $data['tags'] : null;
        
        // Call existing Moodle function to create discussion and first post
        // This function handles all business logic including:
        // - Creating the first post record with discussion name as subject
        // - Inserting discussion record with link to first post
        // - Processing file attachments via itemid
        // - Initializing read tracking for the user
        // - Triggering completion tracking
        // - Emitting forum events for observers
        // - Purging relevant caches
        // We do NOT reimplement any of this logic - we delegate completely
        try {
            $discussionid = forum_add_discussion($discussion, null);
            
            if (!$discussionid) {
                throw new ApiException(500, 'FORUM_ERROR', 'Failed to create discussion', [
                    'function' => 'forum_add_discussion',
                    'returnValue' => $discussionid
                ]);
            }
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to API exceptions for consistent error handling
            throw new ApiException(400, 'FORUM_ERROR', $e->getMessage(), [
                'errorCode' => $e->errorcode,
                'module' => $e->module ?? 'mod_forum',
                'originalException' => get_class($e)
            ]);
        }
        
        // Retrieve the created discussion record to return complete data
        $createddiscussion = $DB->get_record('forum_discussions', ['id' => $discussionid], '*', MUST_EXIST);
        
        // Apply tags to the first post if tags were provided
        // Tags are applied to the post, not the discussion itself
        // This uses core_tag_tag::set_item_tags() from Moodle's tagging system
        if ($tags !== null && count($tags) > 0) {
            try {
                core_tag_tag::set_item_tags(
                    'mod_forum',                // Component
                    'forum_posts',              // Item type
                    $createddiscussion->firstpost,  // Item ID (first post)
                    $context,                   // Context for tags
                    $tags                       // Array of tag names
                );
            } catch (Exception $e) {
                // Log tag errors but don't fail the request since discussion was created
                // Tags are non-critical metadata that shouldn't block discussion creation
                error_log("Failed to apply tags to forum post {$createddiscussion->firstpost}: " . $e->getMessage());
            }
        }
        
        // Prepare success response with created discussion data
        // Return essential fields for React frontend to update UI
        $response = [
            'discussionid' => $createddiscussion->id,
            'firstpost' => $createddiscussion->firstpost,
            'name' => $createddiscussion->name,
            'groupid' => $createddiscussion->groupid,
            'timestart' => $createddiscussion->timestart,
            'timeend' => $createddiscussion->timeend,
            'pinned' => $createddiscussion->pinned,
            'timemodified' => $createddiscussion->timemodified,
            'userid' => $createddiscussion->userid,
            'usermodified' => $createddiscussion->usermodified
        ];
        
        // Return 201 Created status with discussion data
        // HTTP 201 indicates a new resource was successfully created
        return $this->success($response, 201);
    }
}

// Instantiate and execute the endpoint
// This runs the request through ApiBase::execute() which handles:
// - JWT authentication
// - HTTP method routing to handle_post()
// - Exception catching and error response formatting
// - CORS header management
$endpoint = new ForumCreateDiscussionEndpoint();
$endpoint->execute();
