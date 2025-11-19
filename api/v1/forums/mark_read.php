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
 * REST API endpoint for marking forum discussions as read.
 *
 * Implements POST /api/v1/forums/discussions/{id}/read to update read tracking
 * status for the authenticated user in a forum discussion. This endpoint extends
 * ApiBase for JWT authentication and delegates to Moodle's existing forum read
 * tracking functions without duplicating business logic.
 *
 * The endpoint:
 * - Validates user authentication via JWT token
 * - Extracts discussion ID from URL path or request body
 * - Verifies discussion exists and user has access permissions
 * - Checks if forum tracking is enabled for the forum
 * - Marks all posts in the discussion as read for the current user
 * - Returns 204 No Content on success
 *
 * Error handling:
 * - 400: Invalid discussion ID format
 * - 401: User not authenticated
 * - 403: User lacks permission to view the discussion
 * - 404: Discussion not found
 * - 500: Read tracking disabled or internal error
 *
 * Usage example:
 * POST /api/v1/forums/discussions/123/read
 * Authorization: Bearer <jwt_token>
 *
 * Or with JSON body:
 * POST /api/v1/forums/mark_read
 * Content-Type: application/json
 * Authorization: Bearer <jwt_token>
 * {"discussionid": 123}
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and exceptions
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Load Moodle forum library for forum tracking functions
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    require_once($CFG->dirroot . '/mod/forum/lib.php');
}

/**
 * Forum mark read endpoint class.
 *
 * Handles POST requests to mark forum discussions as read for authenticated users.
 * Extends ApiBase to inherit JWT authentication, request routing, and error handling.
 */
class ForumMarkReadEndpoint extends ApiBase {
    
    /**
     * Handle POST request to mark discussion as read.
     *
     * This method:
     * 1. Validates user is authenticated
     * 2. Extracts discussion ID from URL path or JSON body
     * 3. Validates discussion ID is a valid integer
     * 4. Retrieves discussion record from database
     * 5. Retrieves associated forum and course module
     * 6. Checks user has permission to view the discussion
     * 7. Verifies forum tracking is enabled
     * 8. Marks all posts in discussion as read for current user
     * 9. Returns 204 No Content on success
     *
     * @return void Outputs 204 No Content response
     * @throws UnauthorizedException If user is not authenticated
     * @throws ValidationException If discussion ID is invalid
     * @throws NotFoundException If discussion does not exist
     * @throws ForbiddenException If user cannot view discussion
     * @throws ServerException If read tracking is disabled or operation fails
     */
    protected function handle_post() {
        global $DB, $USER;
        
        // Ensure user is authenticated
        $user = $this->getUser();
        
        // Set global $USER for Moodle functions that expect it
        $USER = $user;
        
        // Extract discussion ID from URL path or JSON body
        $discussionid = $this->extractDiscussionId();
        
        // Validate discussion ID is a positive integer
        if (!is_numeric($discussionid) || $discussionid <= 0) {
            throw new ValidationException('Invalid discussion ID', [
                'discussionId' => $discussionid,
                'expected' => 'Positive integer',
                'reason' => 'Discussion ID must be a valid positive integer'
            ]);
        }
        
        // Cast to integer for database query
        $discussionid = (int)$discussionid;
        
        // Retrieve discussion record from database
        $discussion = $DB->get_record('forum_discussions', ['id' => $discussionid]);
        
        if (!$discussion) {
            throw new NotFoundException('Discussion not found', [
                'discussionId' => $discussionid,
                'reason' => 'The specified discussion does not exist'
            ]);
        }
        
        // Retrieve forum record
        $forum = $DB->get_record('forum', ['id' => $discussion->forum]);
        
        if (!$forum) {
            throw new NotFoundException('Forum not found', [
                'forumId' => $discussion->forum,
                'discussionId' => $discussionid,
                'reason' => 'The forum for this discussion does not exist'
            ]);
        }
        
        // Get course module for context and permission checking
        $cm = get_coursemodule_from_instance('forum', $forum->id, $forum->course);
        
        if (!$cm) {
            throw new NotFoundException('Course module not found', [
                'forumId' => $forum->id,
                'courseId' => $forum->course,
                'reason' => 'The course module for this forum does not exist'
            ]);
        }
        
        // Get context for permission checking
        $context = context_module::instance($cm->id);
        
        // Check if user can view this discussion using existing Moodle function
        // This function checks:
        // - mod/forum:viewdiscussion capability
        // - Timed discussion visibility
        // - Group discussion visibility
        $canView = forum_user_can_see_discussion($forum, $discussion, $context, $user);
        
        if (!$canView) {
            throw new ForbiddenException('You do not have permission to view this discussion', [
                'discussionId' => $discussionid,
                'forumId' => $forum->id,
                'userId' => $user->id,
                'requiredCapability' => 'mod/forum:viewdiscussion',
                'reason' => 'User lacks permission to view discussion or discussion has restrictions'
            ]);
        }
        
        // Check if forum tracking is enabled for this forum and user
        // This checks global settings, forum settings, and user preferences
        $canTrack = forum_tp_can_track_forums($forum, $user);
        
        if (!$canTrack) {
            throw new ServerException('Read tracking is not available for this forum', [
                'forumId' => $forum->id,
                'userId' => $user->id,
                'reason' => 'Forum tracking is disabled globally, for this forum, or for this user'
            ]);
        }
        
        // Check if this specific forum is being tracked by the user
        $isTracked = forum_tp_is_tracked($forum, $user);
        
        if (!$isTracked) {
            throw new ServerException('This forum is not tracked by your user account', [
                'forumId' => $forum->id,
                'userId' => $user->id,
                'trackingType' => $forum->trackingtype,
                'reason' => 'User has disabled tracking for this forum or tracking is not configured'
            ]);
        }
        
        // Mark all posts in the discussion as read for this user
        // This function:
        // - Finds all unread posts in the discussion (within cutoff date)
        // - Creates forum_read records for each unread post
        // - Returns true on success
        try {
            $success = forum_tp_mark_discussion_read($user, $discussionid);
            
            if (!$success) {
                throw new ServerException('Failed to mark discussion as read', [
                    'discussionId' => $discussionid,
                    'userId' => $user->id,
                    'reason' => 'Unknown error occurred while marking posts as read'
                ]);
            }
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to API exceptions
            throw new ServerException('Error marking discussion as read: ' . $e->getMessage(), [
                'discussionId' => $discussionid,
                'userId' => $user->id,
                'moodleError' => $e->errorcode,
                'originalMessage' => $e->getMessage()
            ]);
            
        } catch (Exception $e) {
            // Handle unexpected exceptions
            throw new ServerException('Unexpected error marking discussion as read', [
                'discussionId' => $discussionid,
                'userId' => $user->id,
                'error' => $e->getMessage()
            ]);
        }
        
        // Return 204 No Content to indicate successful operation with no response body
        noContent();
    }
    
    /**
     * Extract discussion ID from URL path or JSON body.
     *
     * Attempts to extract discussion ID in two ways:
     * 1. From URL path pattern: /api/v1/forums/discussions/{id}/read
     * 2. From JSON body field: discussionid
     *
     * URL path takes precedence over JSON body for RESTful semantics.
     *
     * @return int Discussion ID
     * @throws ValidationException If discussion ID cannot be extracted
     */
    private function extractDiscussionId() {
        // Try to extract from URL path first (RESTful pattern)
        // Pattern: /api/v1/forums/discussions/{discussionid}/read
        if (preg_match('#/discussions/(\d+)/read#', $this->requestUri, $matches)) {
            return (int)$matches[1];
        }
        
        // Fall back to JSON body if URL pattern doesn't match
        // This supports alternative endpoint: POST /api/v1/forums/mark_read
        try {
            $body = $this->getJsonBody();
            
            if (isset($body['discussionid'])) {
                return $body['discussionid'];
            }
            
            // Check alternative field name
            if (isset($body['id'])) {
                return $body['id'];
            }
            
        } catch (ValidationException $e) {
            // If JSON parsing fails, throw more specific error
            throw new ValidationException('Missing discussion ID', [
                'reason' => 'Discussion ID must be provided in URL path or JSON body',
                'urlPattern' => '/api/v1/forums/discussions/{id}/read',
                'jsonFields' => ['discussionid', 'id'],
                'jsonError' => $e->getMessage()
            ]);
        }
        
        // No discussion ID found in URL or body
        throw new ValidationException('Missing discussion ID', [
            'reason' => 'Discussion ID must be provided in URL path or JSON body',
            'urlPattern' => '/api/v1/forums/discussions/{id}/read',
            'jsonFields' => ['discussionid', 'id']
        ]);
    }
    
    /**
     * Handle GET requests (not supported).
     *
     * @throws MethodNotAllowedException Always, as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method is not supported for this endpoint', [
            'supportedMethods' => ['POST'],
            'endpoint' => '/api/v1/forums/discussions/{id}/read'
        ]);
    }
    
    /**
     * Handle PUT requests (not supported).
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for this endpoint', [
            'supportedMethods' => ['POST'],
            'endpoint' => '/api/v1/forums/discussions/{id}/read'
        ]);
    }
    
    /**
     * Handle DELETE requests (not supported).
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for this endpoint', [
            'supportedMethods' => ['POST'],
            'endpoint' => '/api/v1/forums/discussions/{id}/read'
        ]);
    }
}

// Instantiate and execute the endpoint

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new ForumMarkReadEndpoint();
    $endpoint->execute();
}
