<?php
/**
 * Moodle REST API - Forum Update Post Endpoint
 *
 * PUT /api/v1/forums/posts/{id}
 * Updates an existing forum post with new content, subject, and other modifiable fields.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include required Moodle files
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/forum/lib.php');
require_once($CFG->dirroot . '/lib/accesslib.php');

// Include API utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Forum Update Post API Endpoint
 *
 * Handles PUT requests to update existing forum posts. Validates user authentication,
 * checks edit permissions (own post within time window OR editanypost capability),
 * validates pinned field permissions for discussion starters, and delegates to
 * forum_update_post() for actual update without duplicating business logic.
 *
 * @copyright  2024 Moodle
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class ForumUpdatePostEndpoint extends ApiBase {

    /**
     * Handle PUT request to update a forum post
     *
     * @return void
     * @throws ValidationException If post ID is invalid or request data is malformed
     * @throws NotFoundException If post, discussion, or forum not found
     * @throws ForbiddenException If user lacks edit permissions
     */
    protected function handle_put() {
        global $DB, $USER, $CFG;

        // Extract post ID from URL path using regex
        if (!preg_match('/posts\/(\d+)$/', $this->requestUri, $matches)) {
            throw new ValidationException('Invalid post ID in URL path');
        }

        $postid = (int)$matches[1];
        if ($postid <= 0) {
            throw new ValidationException('Post ID must be a positive integer');
        }

        // Retrieve the post record
        $post = $DB->get_record('forum_posts', ['id' => $postid]);
        if (!$post) {
            throw new NotFoundException('Forum post not found');
        }

        // Retrieve related discussion
        $discussion = $DB->get_record('forum_discussions', ['id' => $post->discussion]);
        if (!$discussion) {
            throw new NotFoundException('Discussion not found');
        }

        // Retrieve related forum
        $forum = $DB->get_record('forum', ['id' => $discussion->forum]);
        if (!$forum) {
            throw new NotFoundException('Forum not found');
        }

        // Get course module and context
        $cm = get_coursemodule_from_instance('forum', $forum->id);
        if (!$cm) {
            throw new NotFoundException('Course module not found');
        }

        $context = context_module::instance($cm->id);

        // Get authenticated user
        $user = $this->getUser();
        if (!$user) {
            throw new ForbiddenException('User must be authenticated');
        }

        // Check edit permissions
        $caneditanypost = has_capability('mod/forum:editanypost', $context, $user);
        
        // Check if user owns the post
        $ownpost = ($post->userid == $user->id);
        
        if (!$caneditanypost) {
            // If user doesn't have editanypost capability, they must own the post
            if (!$ownpost) {
                throw new ForbiddenException('You can only edit your own posts');
            }

            // Check time window for editing own posts
            if (isset($CFG->maxeditingtime) && $CFG->maxeditingtime > 0) {
                $editcutoff = $post->created + $CFG->maxeditingtime;
                if (time() > $editcutoff) {
                    throw new ForbiddenException('The editing time limit has expired for this post');
                }
            }
        }

        // Get JSON body with updated fields
        $data = $this->getJsonBody();

        // Validate required fields
        if (!isset($data->message) || trim($data->message) === '') {
            throw new ValidationException('Post message cannot be empty');
        }

        // Validate message format if provided
        if (isset($data->messageformat)) {
            $validformats = [FORMAT_HTML, FORMAT_PLAIN, FORMAT_MARKDOWN, FORMAT_MOODLE];
            if (!in_array($data->messageformat, $validformats)) {
                throw new ValidationException('Invalid message format');
            }
        }

        // Validate timestamps if provided
        if (isset($data->timestart) && $data->timestart < 0) {
            throw new ValidationException('Invalid timestart value');
        }
        if (isset($data->timeend) && $data->timeend < 0) {
            throw new ValidationException('Invalid timeend value');
        }
        if (isset($data->timestart) && isset($data->timeend) && $data->timestart > 0 && $data->timeend > 0) {
            if ($data->timeend < $data->timestart) {
                throw new ValidationException('End time must be after start time');
            }
        }

        // Create post object for update
        $newpost = new stdClass();
        $newpost->id = $postid;
        
        // Set subject if provided (only for first posts)
        $isfirstpost = ($post->parent == 0);
        if (isset($data->subject)) {
            if ($isfirstpost) {
                $newpost->subject = trim($data->subject);
            } else {
                // Non-first posts don't have editable subjects
                // Silently ignore or we could throw validation error
            }
        }

        // Set message (required)
        $newpost->message = $data->message;

        // Set message format if provided
        if (isset($data->messageformat)) {
            $newpost->messageformat = $data->messageformat;
        }

        // Set timestart and timeend if provided (only for first posts)
        if ($isfirstpost) {
            if (isset($data->timestart)) {
                $newpost->timestart = $data->timestart;
            }
            if (isset($data->timeend)) {
                $newpost->timeend = $data->timeend;
            }
        }

        // Handle pinned field for first posts (discussion starters)
        if ($isfirstpost && isset($data->pinned)) {
            // Check if user has permission to pin discussions
            // Forum type must not be 'single' and user must have pindiscussions capability
            if ($forum->type !== 'single' && has_capability('mod/forum:pindiscussions', $context, $user)) {
                // User can change pinned status
                $newpost->pinned = !empty($data->pinned) ? FORUM_DISCUSSION_PINNED : FORUM_DISCUSSION_UNPINNED;
            } else {
                // User doesn't have permission - keep original value (don't set field)
                // This prevents unauthorized pinning changes
            }
        }

        // Set forum ID for the update function
        $newpost->forum = $forum->id;

        // Call existing Moodle function to update the post
        // This function handles:
        // - Setting modified timestamp
        // - Updating discussion metadata for first posts
        // - Message cleanup and formatting
        // - File attachment processing (if itemid provided)
        // - Triggering events
        try {
            $success = forum_update_post($newpost, null);
            if (!$success) {
                throw new ApiException('Failed to update forum post', 500);
            }
        } catch (moodle_exception $e) {
            throw new ApiException('Error updating post: ' . $e->getMessage(), 500);
        }

        // Retrieve updated post to return
        $updatedpost = $DB->get_record('forum_posts', ['id' => $postid]);
        if (!$updatedpost) {
            throw new ApiException('Failed to retrieve updated post', 500);
        }

        // If this was a first post, also retrieve updated discussion data
        if ($isfirstpost) {
            $updateddiscussion = $DB->get_record('forum_discussions', ['id' => $post->discussion]);
            $updatedpost->discussion_name = $updateddiscussion->name ?? null;
            $updatedpost->discussion_timestart = $updateddiscussion->timestart ?? null;
            $updatedpost->discussion_timeend = $updateddiscussion->timeend ?? null;
            $updatedpost->discussion_pinned = $updateddiscussion->pinned ?? null;
        }

        // Return success response with updated post
        $this->success($updatedpost, 200);
    }
}

// Instantiate and run the endpoint
$endpoint = new ForumUpdatePostEndpoint();
$endpoint->run();
