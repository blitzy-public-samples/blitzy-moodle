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
 * REST API endpoint for deleting forum posts.
 *
 * Implements DELETE /api/v1/forums/posts/{id} to remove a post and optionally
 * its child replies from a forum discussion. Extends ApiBase for JWT authentication,
 * validates user is authenticated and has post deletion permissions, then delegates
 * to forum_delete_post() function for actual deletion.
 *
 * The endpoint handles:
 * - Post ownership validation (user can delete their own posts with mod/forum:deleteownpost)
 * - Moderator deletion (users with mod/forum:deleteanypost can delete any post)
 * - Discussion starter posts (first post in discussion requires special handling)
 * - Cascading deletion (optional 'children' parameter to delete replies recursively)
 * - Proper cleanup (attachments, ratings, read records, completion tracking)
 *
 * URL Pattern: DELETE /api/v1/forums/posts/{postid}
 * Query Parameters:
 *   - children (optional, boolean): If true, recursively delete all child posts.
 *                                   If false, only delete if post has no children.
 *
 * Success Response: 204 No Content (post deleted successfully)
 *
 * Error Responses:
 *   - 400 Bad Request: Invalid post ID format
 *   - 401 Unauthorized: User not authenticated
 *   - 403 Forbidden: User lacks permission to delete post
 *   - 404 Not Found: Post, discussion, forum, or course not found
 *   - 409 Conflict: Post has children and children=false
 *   - 500 Internal Server Error: Deletion failed or database error
 *
 * @package    api
 * @subpackage forum
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/forum/lib.php');
require_once($CFG->libdir . '/completionlib.php');

// Load API infrastructure
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Forum post deletion endpoint class.
 *
 * Handles HTTP DELETE requests to remove forum posts from discussions.
 * Validates permissions based on post ownership and user capabilities,
 * supports cascading deletion of child posts, and properly handles
 * discussion starter posts which require special consideration.
 *
 * Business logic delegation:
 * - All actual deletion work is performed by forum_delete_post() from mod/forum/lib.php
 * - This endpoint serves as a thin REST wrapper with authentication and authorization
 * - No forum deletion logic is duplicated - only permission checking and parameter extraction
 *
 * @package    api
 * @subpackage forum
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class ForumDeletePostEndpoint extends ApiBase {
    
    /**
     * Handle GET requests (not supported).
     *
     * @throws MethodNotAllowedException Always throws - GET not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method is not supported for this endpoint', [
            'allowedMethods' => ['DELETE'],
            'endpoint' => '/api/v1/forums/posts/{id}'
        ]);
    }
    
    /**
     * Handle POST requests (not supported).
     *
     * @throws MethodNotAllowedException Always throws - POST not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for this endpoint', [
            'allowedMethods' => ['DELETE'],
            'endpoint' => '/api/v1/forums/posts/{id}'
        ]);
    }
    
    /**
     * Handle PUT requests (not supported).
     *
     * @throws MethodNotAllowedException Always throws - PUT not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for this endpoint', [
            'allowedMethods' => ['DELETE'],
            'endpoint' => '/api/v1/forums/posts/{id}'
        ]);
    }
    
    /**
     * Handle DELETE requests to remove a forum post.
     *
     * This method implements the complete post deletion flow:
     * 1. Extract and validate post ID from URL path
     * 2. Retrieve post, discussion, forum, and course records
     * 3. Get course module and context for permission checking
     * 4. Determine if user can delete post (own vs any)
     * 5. Handle discussion starter posts with special logic
     * 6. Get cascade deletion preference from query parameter
     * 7. Call forum_delete_post() to perform actual deletion
     * 8. Return 204 No Content on success
     *
     * Discussion Starter Handling:
     * - Discussion starter is the first post (parent=0) in a discussion
     * - Deleting it effectively removes the entire discussion
     * - Requires careful permission checking and confirmation
     * - All child posts are automatically deleted recursively
     *
     * Cascade Deletion:
     * - children=true: Delete post and all replies recursively
     * - children=false: Only delete if post has no children (returns error otherwise)
     * - Default: false (safer - prevents accidental deletion of reply trees)
     *
     * Permission Logic:
     * - Post owner with mod/forum:deleteownpost can delete their own posts
     * - Users with mod/forum:deleteanypost can delete any post (moderators)
     * - Both capabilities are checked within the forum's module context
     * - Additional time-based restrictions may apply (edit timeout)
     *
     * @return void Sends 204 No Content response on success
     * @throws ValidationException If post ID is invalid or missing
     * @throws NotFoundException If post, discussion, forum, or course not found
     * @throws ForbiddenException If user lacks permission to delete post
     * @throws BadRequestException If post has children and children=false
     * @throws ServerException If deletion fails for any reason
     */
    protected function handle_delete() {
        global $DB, $USER;
        
        // Get authenticated user (throws UnauthorizedException if not authenticated)
        $user = $this->getUser();
        
        // Set global $USER for Moodle functions that depend on it
        $USER = $user;
        
        // Extract post ID from URL path using regex
        // Expected pattern: /api/v1/forums/posts/123
        $matches = [];
        $pattern = '/posts\/(\d+)$/';
        
        if (!preg_match($pattern, $this->requestUri, $matches)) {
            throw new ValidationException('Invalid request URL format', [
                'expected' => '/api/v1/forums/posts/{id}',
                'received' => $this->requestUri,
                'reason' => 'Post ID must be provided in URL path'
            ]);
        }
        
        // Get post ID from regex capture group
        $postid = (int)$matches[1];
        
        // Validate post ID is a positive integer
        if ($postid <= 0) {
            throw new ValidationException('Invalid post ID', [
                'postId' => $postid,
                'reason' => 'Post ID must be a positive integer'
            ]);
        }
        
        // Retrieve post record from database
        $post = $DB->get_record('forum_posts', ['id' => $postid]);
        
        if (!$post) {
            throw new NotFoundException('Forum post not found', [
                'postId' => $postid,
                'reason' => 'No post exists with the specified ID'
            ]);
        }
        
        // Retrieve discussion record
        $discussion = $DB->get_record('forum_discussions', ['id' => $post->discussion]);
        
        if (!$discussion) {
            throw new NotFoundException('Forum discussion not found', [
                'discussionId' => $post->discussion,
                'postId' => $postid,
                'reason' => 'Discussion associated with post does not exist'
            ]);
        }
        
        // Retrieve forum record
        $forum = $DB->get_record('forum', ['id' => $discussion->forum]);
        
        if (!$forum) {
            throw new NotFoundException('Forum not found', [
                'forumId' => $discussion->forum,
                'discussionId' => $post->discussion,
                'postId' => $postid,
                'reason' => 'Forum associated with discussion does not exist'
            ]);
        }
        
        // Retrieve course record
        $course = $DB->get_record('course', ['id' => $forum->course]);
        
        if (!$course) {
            throw new NotFoundException('Course not found', [
                'courseId' => $forum->course,
                'forumId' => $discussion->forum,
                'reason' => 'Course associated with forum does not exist'
            ]);
        }
        
        // Get course module record
        $cm = get_coursemodule_from_instance('forum', $forum->id, $course->id);
        
        if (!$cm) {
            throw new NotFoundException('Course module not found', [
                'forumId' => $forum->id,
                'courseId' => $course->id,
                'reason' => 'Course module for forum does not exist'
            ]);
        }
        
        // Get module context for capability checking
        $context = context_module::instance($cm->id);
        
        // Determine required capability based on post ownership
        $canDeleteOwn = false;
        $canDeleteAny = false;
        
        try {
            // Check if user can delete their own posts
            if ((int)$post->userid === (int)$user->id) {
                require_capability('mod/forum:deleteownpost', $context, $user->id);
                $canDeleteOwn = true;
            }
        } catch (moodle_exception $e) {
            // User cannot delete own post - continue to check deleteanypost
            $canDeleteOwn = false;
        }
        
        try {
            // Check if user can delete any post (moderator capability)
            require_capability('mod/forum:deleteanypost', $context, $user->id);
            $canDeleteAny = true;
        } catch (moodle_exception $e) {
            // User cannot delete any post
            $canDeleteAny = false;
        }
        
        // Throw exception if user has neither permission
        if (!$canDeleteOwn && !$canDeleteAny) {
            throw new ForbiddenException('You do not have permission to delete this post', [
                'postId' => $postid,
                'postUserId' => $post->userid,
                'currentUserId' => $user->id,
                'requiredCapability' => ($post->userid === $user->id) 
                    ? 'mod/forum:deleteownpost' 
                    : 'mod/forum:deleteanypost',
                'contextId' => $context->id,
                'reason' => 'User lacks required capability to delete forum post'
            ]);
        }
        
        // Check if this is a discussion starter post (first post, parent=0)
        $isDiscussionStarter = ((int)$post->parent === 0);
        
        if ($isDiscussionStarter) {
            // Discussion starter posts require deleting the entire discussion
            // This is a more significant action - verify permission more strictly
            
            // Count total posts in discussion to inform user of impact
            $postCount = $DB->count_records('forum_posts', ['discussion' => $discussion->id]);
            
            // If discussion has multiple posts, this deletion will cascade
            if ($postCount > 1) {
                // For discussion starters with replies, we always cascade delete
                // The 'children' parameter is less relevant here since we're deleting
                // the entire discussion structure
                $children = true;
            } else {
                // Single post discussion - no cascade needed
                $children = false;
            }
        } else {
            // Regular post (not discussion starter)
            // Get cascade deletion preference from query parameter
            // Default to false for safety (only delete if no children exist)
            $children = $this->getParam('children', PARAM_BOOL, false, false);
            
            // Check if post has child posts
            $hasChildren = $DB->record_exists('forum_posts', ['parent' => $postid]);
            
            if ($hasChildren && !$children) {
                // Post has children but cascade deletion not requested
                throw new BadRequestException('Cannot delete post with replies', [
                    'postId' => $postid,
                    'reason' => 'Post has child replies. Set children=true to delete all replies recursively',
                    'suggestion' => 'Add query parameter: ?children=true'
                ]);
            }
        }
        
        // Call existing Moodle function to perform deletion
        // This handles all cleanup: attachments, ratings, read records, completion, events
        try {
            $success = forum_delete_post($post, $children, $course, $cm, $forum, false);
            
            if (!$success) {
                throw new ServerException('Failed to delete forum post', [
                    'postId' => $postid,
                    'reason' => 'forum_delete_post() returned false',
                    'details' => 'Database deletion operation failed or post has undeleted children'
                ]);
            }
            
        } catch (moodle_exception $e) {
            // Catch Moodle exceptions from deletion process
            throw new ServerException('Forum post deletion failed', [
                'postId' => $postid,
                'moodleError' => $e->getMessage(),
                'errorCode' => $e->errorcode,
                'reason' => 'Moodle exception occurred during deletion'
            ]);
            
        } catch (Exception $e) {
            // Catch any other unexpected exceptions
            throw new ServerException('Unexpected error during post deletion', [
                'postId' => $postid,
                'error' => $e->getMessage(),
                'reason' => 'Unexpected exception during deletion process'
            ]);
        }
        
        // Deletion successful - return 204 No Content
        // This indicates successful deletion with no response body
        noContent();
    }
}

// Instantiate and execute the endpoint
$endpoint = new ForumDeletePostEndpoint();
$endpoint->execute();
