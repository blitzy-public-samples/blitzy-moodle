<?php
/**
 * REST API Endpoint for Creating Forum Posts
 * 
 * POST /api/v1/forums/discussions/{id}/posts
 * 
 * Creates a new reply post in a forum discussion. Extends ApiBase for JWT authentication
 * and delegates to existing forum_add_new_post() function for all business logic including
 * file handling, message formatting, read tracking, completion tracking, and event emission.
 * 
 * @package    api
 * @subpackage v1/forums
 * @copyright  2024 Moodle React Refactor
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');
// Only require config if not already loaded (for test compatibility)
if (!defined('MOODLE_INTERNAL')) {
    require_once(__DIR__ . '/../../../config.php');
}
require_once($CFG->dirroot . '/mod/forum/lib.php');

/**
 * Forum Create Post Endpoint Class
 * 
 * Handles POST requests to create new forum reply posts. Validates user authentication,
 * permission checks, and delegates to existing Moodle forum functions for post creation.
 */
class ForumCreatePostEndpoint extends ApiBase {
    
    /**
     * Handle POST request to create a new forum post
     * 
     * Validates discussion existence, checks posting permissions, validates input data,
     * and calls forum_add_new_post() to create the post with all associated logic.
     * 
     * @return void Sends JSON response with created post data
     * @throws UnauthorizedException If user is not authenticated
     * @throws NotFoundException If discussion does not exist
     * @throws ForbiddenException If user lacks permission to reply
     * @throws ValidationException If required fields are missing or invalid
     */
    protected function handle_post() {
        global $DB, $USER, $CFG;
        
        // Ensure user is authenticated via JWT
        $user = $this->getUser();
        if (!$user) {
            throw new UnauthorizedException('Authentication required');
        }
        
        // Extract discussion ID from URL path: /api/v1/forums/discussions/{id}/posts
        $matches = [];
        if (!preg_match('/discussions\/(\d+)\/posts/', $this->requestUri, $matches)) {
            throw new ValidationException('Invalid URL format. Expected: /discussions/{id}/posts');
        }
        
        $discussionid = intval($matches[1]);
        if ($discussionid <= 0) {
            throw new ValidationException('Invalid discussion ID');
        }
        
        // Retrieve discussion record
        $discussion = $DB->get_record('forum_discussions', ['id' => $discussionid]);
        if (!$discussion) {
            throw new NotFoundException('Discussion not found');
        }
        
        // Retrieve forum record
        $forum = $DB->get_record('forum', ['id' => $discussion->forum], '*', MUST_EXIST);
        
        // Retrieve course module
        $cm = get_coursemodule_from_instance('forum', $forum->id, $forum->course, false, MUST_EXIST);
        
        // Get module context
        $context = context_module::instance($cm->id);
        
        // Retrieve course record
        $course = $DB->get_record('course', ['id' => $forum->course], '*', MUST_EXIST);
        
        // Check if user can post to this discussion
        if (!forum_user_can_post($forum, $discussion, $user, $cm, $course, $context)) {
            // Determine more specific error message based on common failure reasons
            if (isguestuser($user) || empty($user->id)) {
                throw new ForbiddenException('Guest users cannot post to forums');
            }
            
            if (forum_is_cutoff_date_reached($forum) && !has_capability('mod/forum:canoverridecutoff', $context)) {
                throw new ForbiddenException('Forum cutoff date has been reached');
            }
            
            if (forum_discussion_is_locked($forum, $discussion) && !has_capability('mod/forum:canoverridediscussionlock', $context)) {
                throw new ForbiddenException('Discussion is locked');
            }
            
            // Check enrollment
            if (!is_enrolled($context, $user->id, '', true)) {
                throw new ForbiddenException('You must be enrolled in this course to post');
            }
            
            // Check capability
            $capname = ($forum->type == 'news') ? 'mod/forum:replynews' : 'mod/forum:replypost';
            if (!has_capability($capname, $context, $user->id)) {
                throw new ForbiddenException('You do not have permission to reply to posts in this forum');
            }
            
            // Generic permission denied
            throw new ForbiddenException('You do not have permission to post to this discussion');
        }
        
        // Get JSON request body
        $data = $this->getJsonBody();
        
        // Validate required field: message
        if (!isset($data['message']) || trim($data['message']) === '') {
            throw new ValidationException('Message is required');
        }
        
        $message = trim($data['message']);
        
        // Validate message length (Moodle's default max is typically 65535 characters for TEXT fields)
        if (strlen($message) > 65535) {
            throw new ValidationException('Message exceeds maximum length of 65535 characters');
        }
        
        // Subject is optional - default to "Re: " + discussion name if not provided
        $subject = isset($data['subject']) && trim($data['subject']) !== '' 
            ? trim($data['subject']) 
            : 'Re: ' . $discussion->name;
        
        // Validate subject length
        if (strlen($subject) > 255) {
            throw new ValidationException('Subject exceeds maximum length of 255 characters');
        }
        
        // Parent post ID (0 for direct reply to discussion, or another post ID for threaded reply)
        $parentid = isset($data['parent']) ? intval($data['parent']) : 0;
        
        // If parent is specified, validate it exists and belongs to this discussion
        if ($parentid > 0) {
            $parent = $DB->get_record('forum_posts', ['id' => $parentid]);
            if (!$parent) {
                throw new ValidationException('Parent post not found');
            }
            if ($parent->discussion != $discussionid) {
                throw new ValidationException('Parent post does not belong to this discussion');
            }
        } else {
            // For direct reply to discussion, use first post as parent
            $parent = $DB->get_record('forum_posts', ['discussion' => $discussionid], '*', IGNORE_MULTIPLE);
            if ($parent) {
                $parentid = $parent->id;
            }
        }
        
        // Message format (default to HTML)
        $messageformat = isset($data['messageformat']) ? intval($data['messageformat']) : FORMAT_HTML;
        
        // Validate message format is valid
        if (!in_array($messageformat, [FORMAT_HTML, FORMAT_PLAIN, FORMAT_MARKDOWN, FORMAT_MOODLE])) {
            throw new ValidationException('Invalid message format');
        }
        
        // Item ID for draft file area (for attachments)
        $itemid = isset($data['itemid']) ? intval($data['itemid']) : 0;
        
        // Private reply flag
        $isprivatereply = isset($data['isprivatereply']) ? (bool)$data['isprivatereply'] : false;
        
        // If private reply is requested, validate user has permission
        if ($isprivatereply) {
            if ($parentid > 0) {
                $parentpost = $DB->get_record('forum_posts', ['id' => $parentid], '*', MUST_EXIST);
                if (!forum_user_can_reply_privately($context, $parentpost)) {
                    throw new ForbiddenException('You do not have permission to post private replies, or the parent post is already a private reply');
                }
            } else {
                throw new ValidationException('Private replies require a parent post');
            }
        }
        
        // Check post throttling limits if configured
        if (!empty($forum->blockafter) && !has_capability('mod/forum:postwithoutthrottling', $context)) {
            $blockperiod = isset($forum->blockperiod) ? $forum->blockperiod : 86400; // Default 24 hours
            $since = time() - $blockperiod;
            
            $numposts = $DB->count_records_sql(
                "SELECT COUNT(*) FROM {forum_posts} 
                 WHERE discussion = :discussionid 
                 AND userid = :userid 
                 AND created > :since",
                [
                    'discussionid' => $discussionid,
                    'userid' => $user->id,
                    'since' => $since
                ]
            );
            
            if ($numposts >= $forum->blockafter) {
                throw new ForbiddenException('You have exceeded the post limit for this forum. Please wait before posting again.');
            }
        }
        
        // Create post object for forum_add_new_post()
        $post = new stdClass();
        $post->discussion = $discussionid;
        $post->parent = $parentid;
        $post->subject = $subject;
        $post->message = $message;
        $post->messageformat = $messageformat;
        $post->itemid = $itemid;
        $post->course = $course->id;
        $post->forum = $forum->id;
        
        // Add private reply flag if applicable
        if ($isprivatereply) {
            $post->isprivatereply = true;
        }
        
        // Delegate to existing Moodle function for post creation
        // This handles: setting userid, timestamps, mailed status, file attachments,
        // updating discussion metadata, completion tracking, and event emission
        try {
            $postid = forum_add_new_post($post, null);
            
            if (!$postid) {
                throw new ApiException('Failed to create post', 500);
            }
            
            // Retrieve the created post with all fields
            $createdpost = $DB->get_record('forum_posts', ['id' => $postid], '*', MUST_EXIST);
            
            // Format response data
            $response = [
                'id' => (int)$createdpost->id,
                'discussion' => (int)$createdpost->discussion,
                'parent' => (int)$createdpost->parent,
                'userid' => (int)$createdpost->userid,
                'created' => (int)$createdpost->created,
                'modified' => (int)$createdpost->modified,
                'subject' => $createdpost->subject,
                'message' => $createdpost->message,
                'messageformat' => (int)$createdpost->messageformat,
                'messagetrust' => (int)$createdpost->messagetrust,
                'attachment' => $createdpost->attachment ?? '',
                'totalscore' => (int)($createdpost->totalscore ?? 0),
                'mailnow' => (int)($createdpost->mailnow ?? 0)
            ];
            
            // Add private reply info if applicable
            if (isset($createdpost->privatereplyto) && $createdpost->privatereplyto > 0) {
                $response['privatereplyto'] = (int)$createdpost->privatereplyto;
            }
            
            // Return 201 Created with post data
            $this->success($response, 201);
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to API exceptions
            throw new ApiException($e->getMessage(), 500);
        }
    }
    /**
     * Handle GET requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for forum post creation');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for forum post creation');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for forum post creation');
    }
}

// Instantiate and execute the endpoint

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new ForumCreatePostEndpoint();
    $endpoint->execute();
}
