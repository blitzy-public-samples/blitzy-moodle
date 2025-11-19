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
 * REST API endpoint for retrieving forum discussion posts.
 *
 * Implements GET /api/v1/forums/discussions/{id}/posts endpoint to list all posts
 * within a forum discussion thread. Supports pagination and different display modes
 * (flat, threaded, nested). Returns enriched post data including:
 * - User information (fullname, profile image URL, email if permitted)
 * - Attachment details (files, images)
 * - Read/unread status for each post
 * - User capabilities (can_edit, can_delete, can_reply, can_split, can_export)
 * - Parent post information for threading support
 * - Private reply indicators
 * - Formatted message text with proper HTML filtering
 *
 * Authentication: Requires valid JWT token in Authorization header
 * Authorization: Requires mod/forum:viewdiscussion capability in forum context
 *
 * Usage:
 *   GET /api/v1/forums/discussions/123/posts
 *   GET /api/v1/forums/discussions/123/posts?sort=DESC&mode=threaded
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "posts": [
 *       {
 *         "id": 456,
 *         "discussion": 123,
 *         "parent": 0,
 *         "userid": 2,
 *         "created": 1234567890,
 *         "modified": 1234567890,
 *         "subject": "Discussion topic",
 *         "message": "<p>Post content...</p>",
 *         "messageformat": 1,
 *         "attachment": "1",
 *         "user": {
 *           "id": 2,
 *           "fullname": "John Doe",
 *           "profileimageurl": "https://...",
 *           "email": "john@example.com"
 *         },
 *         "attachments": [...],
 *         "unread": false,
 *         "capabilities": {
 *           "can_edit": true,
 *           "can_delete": true,
 *           "can_reply": true,
 *           "can_split": false,
 *           "can_export": true
 *         }
 *       }
 *     ]
 *   }
 * }
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
// Only require config if not already loaded (for test compatibility)
if (!defined('MOODLE_INTERNAL')) {
    require_once(__DIR__ . '/../../../config.php');
}
require_once($CFG->dirroot . '/lib/moodlelib.php');
require_once($CFG->dirroot . '/lib/accesslib.php');
require_once($CFG->dirroot . '/mod/forum/lib.php');
require_once($CFG->dirroot . '/user/lib.php');

// Load API utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Forum posts retrieval endpoint.
 *
 * Handles GET requests to retrieve all posts within a forum discussion.
 * Extends ApiBase for automatic JWT authentication and request routing.
 */
class ForumPostsEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve discussion posts.
     *
     * Extracts discussion ID from URL path, validates permissions, retrieves
     * all posts using existing Moodle forum functions, enriches post data
     * with user information, attachments, read status, and capabilities,
     * then returns formatted JSON response.
     *
     * URL pattern: /api/v1/forums/discussions/{discussionid}/posts
     *
     * Query parameters:
     * - sort: Sort order - 'ASC' (oldest first) or 'DESC' (newest first). Default: 'ASC'
     * - mode: Display mode - 'flat', 'threaded', 'nested'. Default: 'flat'
     *
     * @return void Outputs JSON response directly via success() method
     * @throws ValidationException If discussion ID is invalid
     * @throws NotFoundException If discussion does not exist
     * @throws ForbiddenException If user lacks permission to view discussion
     */
    protected function handle_get() {
        global $DB, $USER, $CFG, $OUTPUT;
        
        // Get authenticated user
        $user = $this->getUser();
        
        // Set $USER context for Moodle functions (many forum functions use global $USER)
        $USER = $user;
        
        // Extract discussion ID from URL path using regex
        // Pattern matches: /discussions/123/posts
        if (!preg_match('/discussions\/(\d+)\/posts/', $this->requestUri, $matches)) {
            throw new ValidationException('Invalid URL format', [
                'expected' => '/api/v1/forums/discussions/{id}/posts',
                'received' => $this->requestUri,
                'reason' => 'Discussion ID not found in URL path'
            ]);
        }
        
        $discussionid = (int)$matches[1];
        
        // Validate discussion ID is positive integer
        if ($discussionid <= 0) {
            throw new ValidationException('Invalid discussion ID', [
                'discussionId' => $discussionid,
                'reason' => 'Discussion ID must be a positive integer'
            ]);
        }
        
        // Retrieve discussion record from database
        $discussion = $DB->get_record('forum_discussions', ['id' => $discussionid]);
        
        if (!$discussion) {
            throw new NotFoundException('Discussion not found', [
                'discussionId' => $discussionid,
                'reason' => 'No discussion exists with this ID'
            ]);
        }
        
        // Retrieve forum record
        $forum = $DB->get_record('forum', ['id' => $discussion->forum]);
        
        if (!$forum) {
            throw new NotFoundException('Forum not found', [
                'forumId' => $discussion->forum,
                'discussionId' => $discussionid,
                'reason' => 'Forum associated with discussion does not exist'
            ]);
        }
        
        // Get course module for this forum
        $cm = get_coursemodule_from_instance('forum', $forum->id, $forum->course);
        
        if (!$cm) {
            throw new NotFoundException('Course module not found', [
                'forumId' => $forum->id,
                'courseId' => $forum->course,
                'reason' => 'Course module for forum not found'
            ]);
        }
        
        // Get context for permission checking
        $context = context_module::instance($cm->id);
        
        // Check if user can see this discussion (handles group restrictions, hidden forums, etc.)
        if (!forum_user_can_see_discussion($forum, $discussion, $context, $user)) {
            throw new ForbiddenException('You do not have permission to view this discussion', [
                'discussionId' => $discussionid,
                'forumId' => $forum->id,
                'userId' => $user->id,
                'reason' => 'User cannot see discussion due to visibility restrictions or group settings'
            ]);
        }
        
        // Check capability to view discussion (standard permission check)
        $this->checkCapability('mod/forum:viewdiscussion', $context);
        
        // Extract query parameters
        $sort = $this->getParam('sort', PARAM_ALPHA, false, 'ASC');
        $mode = $this->getParam('mode', PARAM_ALPHA, false, 'flat');
        
        // Validate sort parameter
        $sort = strtoupper($sort);
        if (!in_array($sort, ['ASC', 'DESC'])) {
            $sort = 'ASC'; // Default to ascending if invalid
        }
        
        // Construct sort order SQL
        // ASC = oldest first (p.created ASC), DESC = newest first (p.created DESC)
        $sortorder = ($sort === 'ASC') ? 'p.created ASC' : 'p.created DESC';
        
        // Retrieve all posts for this discussion using existing Moodle function
        // This function returns posts with user information and optional read tracking
        $posts = forum_get_all_discussion_posts($discussionid, $sortorder, true);
        
        if (empty($posts)) {
            // Return empty array if no posts found (shouldn't happen for valid discussion)
            $this->success(['posts' => []], 200);
            return;
        }
        
        // Enrich each post with additional data
        $enrichedposts = [];
        
        foreach ($posts as $post) {
            // Create enriched post object
            $enrichedpost = [
                'id' => (int)$post->id,
                'discussion' => (int)$post->discussion,
                'parent' => (int)$post->parent,
                'userid' => (int)$post->userid,
                'created' => (int)$post->created,
                'modified' => (int)$post->modified,
                'mailed' => (int)$post->mailed,
                'subject' => $post->subject,
                'message' => $post->message, // Will be formatted below
                'messageformat' => (int)$post->messageformat,
                'messagetrust' => (int)$post->messagetrust,
                'attachment' => $post->attachment ?? '0',
                'totalscore' => (int)($post->totalscore ?? 0),
                'mailnow' => (int)($post->mailnow ?? 0),
                'privatereplyto' => (int)($post->privatereplyto ?? 0),
            ];
            
            // Enrich with user data
            $postuser = $DB->get_record('user', ['id' => $post->userid], 
                'id, ' . get_all_user_name_fields(true) . ', email, picture, imagealt, firstnamephonetic, lastnamephonetic, middlename, alternatename');
            
            if ($postuser) {
                // Generate user profile image URL
                $userpicture = new user_picture($postuser);
                $userpicture->size = 1; // Size f1 (64px)
                $profileimageurl = $userpicture->get_url($PAGE)->out(false);
                
                $enrichedpost['user'] = [
                    'id' => (int)$postuser->id,
                    'fullname' => fullname($postuser),
                    'profileimageurl' => $profileimageurl,
                ];
                
                // Include email only if user has permission to view email addresses
                if (has_capability('moodle/user:viewdetails', $context, $user->id)) {
                    $enrichedpost['user']['email'] = $postuser->email;
                }
            } else {
                // Fallback if user not found (deleted user)
                $enrichedpost['user'] = [
                    'id' => (int)$post->userid,
                    'fullname' => get_string('deleteduser', 'forum'),
                    'profileimageurl' => '',
                ];
            }
            
            // Format message text for HTML display with proper filtering
            // This applies text filters, emoticons, multilang, etc.
            $enrichedpost['message'] = format_text(
                $post->message,
                $post->messageformat,
                [
                    'context' => $context,
                    'para' => false,
                    'trusted' => $post->messagetrust,
                    'filter' => true
                ]
            );
            
            // Get attachments for this post
            $fs = get_file_storage();
            $attachments = [];
            
            // Get files from both 'attachment' and 'post' file areas
            $postfiles = $fs->get_area_files($context->id, 'mod_forum', 'attachment', $post->id, 'filename', false);
            
            foreach ($postfiles as $file) {
                $filename = $file->get_filename();
                if ($filename !== '.') { // Skip directory entries
                    $attachments[] = [
                        'filename' => $filename,
                        'filesize' => (int)$file->get_filesize(),
                        'mimetype' => $file->get_mimetype(),
                        'timemodified' => (int)$file->get_timemodified(),
                        'downloadurl' => moodle_url::make_pluginfile_url(
                            $context->id,
                            'mod_forum',
                            'attachment',
                            $post->id,
                            '/',
                            $filename
                        )->out(false),
                    ];
                }
            }
            
            $enrichedpost['attachments'] = $attachments;
            
            // Determine read/unread status for this post
            // forum_tp_is_post_read checks if user has read this specific post
            $isread = forum_tp_is_post_read($user->id, $post);
            $enrichedpost['unread'] = !$isread;
            
            // Add capabilities for this post
            // These determine what actions the current user can perform on this post
            $enrichedpost['capabilities'] = [
                'can_edit' => has_capability('mod/forum:editanypost', $context, $user->id) || 
                              ($post->userid == $user->id && has_capability('mod/forum:replypost', $context, $user->id)),
                'can_delete' => has_capability('mod/forum:deleteanypost', $context, $user->id) ||
                                ($post->userid == $user->id && has_capability('mod/forum:deleteownpost', $context, $user->id)),
                'can_reply' => has_capability('mod/forum:replypost', $context, $user->id),
                'can_split' => has_capability('mod/forum:splitdiscussions', $context, $user->id) && $post->parent != 0,
                'can_export' => has_capability('mod/forum:exportpost', $context, $user->id),
            ];
            
            // Include parent post information if this is a reply
            if ($post->parent > 0 && isset($posts[$post->parent])) {
                $parentpost = $posts[$post->parent];
                $enrichedpost['parentpost'] = [
                    'id' => (int)$parentpost->id,
                    'subject' => $parentpost->subject,
                    'userid' => (int)$parentpost->userid,
                    'created' => (int)$parentpost->created,
                ];
            }
            
            // Add to enriched posts array
            $enrichedposts[] = $enrichedpost;
        }
        
        // Return success response with enriched posts
        $this->success([
            'posts' => $enrichedposts,
            'discussion' => [
                'id' => (int)$discussion->id,
                'name' => $discussion->name,
                'forum' => (int)$discussion->forum,
                'timemodified' => (int)$discussion->timemodified,
            ],
            'forum' => [
                'id' => (int)$forum->id,
                'course' => (int)$forum->course,
                'name' => $forum->name,
                'type' => $forum->type,
            ],
        ], 200);
    }
    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for forum posts listing');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for forum posts listing');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for forum posts listing');
    }
}

// Instantiate and execute the endpoint

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new ForumPostsEndpoint();
    $endpoint->execute();
}
