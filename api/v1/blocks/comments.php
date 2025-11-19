<?php
/**
 * Comments Block API Endpoint
 *
 * REST API endpoint for fetching and posting comments. Provides comments
 * widget data for React components by wrapping the existing Moodle comment
 * system (core_comment\manager).
 *
 * GET /api/v1/blocks/comments - Fetch comments for a specific item
 * POST /api/v1/blocks/comments - Add a new comment to an item
 *
 * This endpoint acts as a thin wrapper around Moodle's core comment
 * functionality, using the core_comment\manager class from
 * public/comment/classes/manager.php. All business logic remains in the
 * existing Moodle comment system - this endpoint only handles API concerns
 * like parameter validation, permission checking, and response formatting.
 *
 * @package    api
 * @subpackage v1/blocks
 * @copyright  2024 Moodle React Migration
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/comment/classes/manager.php');

// Load API utilities
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * Comments Block API Endpoint Class
 *
 * Handles GET and POST requests for comment data. Extends ApiBase to inherit
 * JWT authentication, HTTP routing, and standardized response formatting.
 *
 * GET requests fetch comments for a specific component/area/item combination.
 * POST requests add new comments. All operations use the existing Moodle
 * comment permission system and business logic.
 */
class BlockCommentsEndpoint extends ApiBase {
    
    /**
     * Handle GET request to fetch comments.
     *
     * Retrieves comments for a specific item identified by component, comment
     * area, and item ID. Uses the core_comment\manager class to fetch comments
     * with proper permission checking via the existing Moodle comment system.
     *
     * Required Parameters:
     * - component: Component name (e.g., 'assignsubmission_comments')
     * - commentarea: Area identifier (e.g., 'submission_comments')
     * - itemid: ID of the item to get comments for
     *
     * Optional Parameters:
     * - contextid: Context ID (if not provided, will use courseid)
     * - courseid: Course ID (used to derive context if contextid not provided)
     *
     * @return void Outputs JSON response
     * @throws ValidationException If required parameters are missing or invalid
     * @throws PermissionException If user lacks permission to view comments
     */
    protected function handle_get() {
        global $DB;
        
        // Extract and validate required parameters
        $component = $this->getParam('component', PARAM_ALPHANUMERIC, true);
        $commentarea = $this->getParam('commentarea', PARAM_ALPHANUMERIC, true);
        $itemid = $this->getParam('itemid', PARAM_INT, true);
        
        // Extract optional parameters
        $contextid = $this->getParam('contextid', PARAM_INT, false);
        $courseid = $this->getParam('courseid', PARAM_INT, false);
        
        // Determine context - contextid takes precedence, otherwise derive from courseid
        $context = null;
        if ($contextid) {
            $context = context::instance_by_id($contextid);
        } else if ($courseid) {
            $context = context_course::instance($courseid);
        } else {
            // Default to system context if neither provided
            $context = context_system::instance();
        }
        
        // Get course object if courseid provided
        $course = null;
        if ($courseid) {
            $course = $DB->get_record('course', ['id' => $courseid]);
            if (!$course) {
                $this->error(
                    'COURSE_NOT_FOUND',
                    'Course not found',
                    404,
                    ['courseid' => $courseid]
                );
                return;
            }
        }
        
        // Create configuration object for comment manager
        // Following same pattern as block_comments.php
        $options = new stdClass();
        $options->component = $component;
        $options->commentarea = $commentarea;
        $options->itemid = $itemid;
        $options->context = $context;
        $options->course = $course;
        $options->area = $commentarea; // area is alias for commentarea
        
        // Optional display options (for API we use minimal display settings)
        $options->linktext = ''; // No link text needed for API
        $options->notoggle = true; // No toggle UI in API
        $options->autostart = true; // Load comments immediately
        $options->displaycancel = false; // No cancel button in API
        
        try {
            // Instantiate comment manager with configuration
            // This initializes permission checking via has_capability()
            $manager = new \core_comment\manager($options);
            
            // Check if user has permission to view comments
            // This uses the permission flags set during manager initialization
            if (!$manager->can_view()) {
                $this->error(
                    'PERMISSION_DENIED',
                    'You do not have permission to view comments',
                    403,
                    [
                        'required_capability' => 'moodle/comment:view',
                        'component' => $component,
                        'commentarea' => $commentarea
                    ]
                );
                return;
            }
            
            // Fetch comments using existing Moodle function
            // Returns array of comment objects with all necessary properties
            $commentsData = $manager->get_comments(0); // page 0 = all comments
            
            // Transform comments into clean format for API response
            $comments = [];
            if (!empty($commentsData) && is_object($commentsData) && isset($commentsData->comments)) {
                foreach ($commentsData->comments as $comment) {
                    $comments[] = [
                        'id' => $comment->id,
                        'content' => $comment->content,
                        'format' => $comment->format ?? FORMAT_PLAIN,
                        'timecreated' => $comment->timecreated,
                        'userid' => $comment->userid,
                        'fullname' => $comment->fullname ?? '',
                        'profileimageurl' => $comment->profileimageurl ?? '',
                        'can_delete' => $comment->delete ?? false
                    ];
                }
            }
            
            // Check if user can post comments
            $canPost = $manager->can_post();
            
            // Count total comments
            $total = count($comments);
            
            // Return success response with comments and metadata
            $this->success([
                'comments' => $comments,
                'can_post' => $canPost,
                'total' => $total,
                'component' => $component,
                'commentarea' => $commentarea,
                'itemid' => $itemid
            ]);
            
        } catch (\comment_exception $e) {
            // Handle comment-specific exceptions
            $this->error(
                'COMMENT_ERROR',
                $e->getMessage(),
                400,
                [
                    'component' => $component,
                    'commentarea' => $commentarea,
                    'error_code' => $e->getCode()
                ]
            );
        } catch (\Exception $e) {
            // Handle unexpected errors
            $this->error(
                'INTERNAL_ERROR',
                'Failed to retrieve comments: ' . $e->getMessage(),
                500,
                [
                    'component' => $component,
                    'commentarea' => $commentarea
                ]
            );
        }
    }
    
    /**
     * Handle PUT requests (not supported for comments endpoint).
     *
     * Comments cannot be edited via this endpoint. Throws MethodNotAllowedException.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for comments endpoint');
    }
    
    /**
     * Handle DELETE requests (not supported for comments endpoint).
     *
     * Comments cannot be deleted via this endpoint. Throws MethodNotAllowedException.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for comments endpoint');
    }
    
    /**
     * Handle POST request to add a new comment.
     *
     * Creates a new comment for the specified item using the core_comment\manager
     * class. Validates user has permission to post comments before creating.
     *
     * Required Parameters (query string):
     * - component: Component name (e.g., 'assignsubmission_comments')
     * - commentarea: Area identifier (e.g., 'submission_comments')
     * - itemid: ID of the item to comment on
     *
     * Optional Parameters (query string):
     * - contextid: Context ID (if not provided, will use courseid)
     * - courseid: Course ID (used to derive context if contextid not provided)
     *
     * Required JSON Body:
     * - content: The comment text to add
     *
     * @return void Outputs JSON response
     * @throws ValidationException If required parameters are missing or invalid
     * @throws PermissionException If user lacks permission to post comments
     */
    protected function handle_post() {
        global $DB;
        
        // Extract and validate required parameters from query string
        $component = $this->getParam('component', PARAM_ALPHANUMERIC, true);
        $commentarea = $this->getParam('commentarea', PARAM_ALPHANUMERIC, true);
        $itemid = $this->getParam('itemid', PARAM_INT, true);
        
        // Extract optional parameters
        $contextid = $this->getParam('contextid', PARAM_INT, false);
        $courseid = $this->getParam('courseid', PARAM_INT, false);
        
        // Get JSON request body
        try {
            $jsonBody = $this->getJsonBody();
        } catch (\Exception $e) {
            $this->error(
                'INVALID_JSON',
                'Invalid or missing JSON body',
                400,
                ['reason' => $e->getMessage()]
            );
            return;
        }
        
        // Extract and validate content from JSON body
        if (!isset($jsonBody['content']) || trim($jsonBody['content']) === '') {
            $this->error(
                'MISSING_CONTENT',
                'Comment content is required',
                400,
                ['received' => $jsonBody]
            );
            return;
        }
        
        $content = trim($jsonBody['content']);
        
        // Determine context - contextid takes precedence, otherwise derive from courseid
        $context = null;
        if ($contextid) {
            $context = context::instance_by_id($contextid);
        } else if ($courseid) {
            $context = context_course::instance($courseid);
        } else {
            // Default to system context if neither provided
            $context = context_system::instance();
        }
        
        // Get course object if courseid provided
        $course = null;
        if ($courseid) {
            $course = $DB->get_record('course', ['id' => $courseid]);
            if (!$course) {
                $this->error(
                    'COURSE_NOT_FOUND',
                    'Course not found',
                    404,
                    ['courseid' => $courseid]
                );
                return;
            }
        }
        
        // Create configuration object for comment manager
        $options = new stdClass();
        $options->component = $component;
        $options->commentarea = $commentarea;
        $options->itemid = $itemid;
        $options->context = $context;
        $options->course = $course;
        $options->area = $commentarea;
        
        // Optional display options
        $options->linktext = '';
        $options->notoggle = true;
        $options->autostart = true;
        $options->displaycancel = false;
        
        try {
            // Instantiate comment manager
            $manager = new \core_comment\manager($options);
            
            // Check if user has permission to post comments
            if (!$manager->can_post()) {
                $this->error(
                    'PERMISSION_DENIED',
                    'You do not have permission to post comments',
                    403,
                    [
                        'required_capability' => 'moodle/comment:post',
                        'component' => $component,
                        'commentarea' => $commentarea
                    ]
                );
                return;
            }
            
            // Add comment using existing Moodle function
            // The add() method handles all business logic including:
            // - Creating database record
            // - Triggering comment_created event
            // - Sending notifications
            // - Updating completion tracking
            $newcomment = $manager->add($content);
            
            // Check if comment was successfully created
            if (!$newcomment) {
                $this->error(
                    'COMMENT_CREATE_FAILED',
                    'Failed to create comment',
                    500,
                    [
                        'component' => $component,
                        'commentarea' => $commentarea
                    ]
                );
                return;
            }
            
            // Return success response with new comment data
            $this->success([
                'comment' => [
                    'id' => $newcomment->id,
                    'content' => $newcomment->content,
                    'format' => $newcomment->format ?? FORMAT_PLAIN,
                    'timecreated' => $newcomment->timecreated,
                    'userid' => $newcomment->userid
                ],
                'message' => 'Comment added successfully'
            ], 201); // 201 Created status code
            
        } catch (\comment_exception $e) {
            // Handle comment-specific exceptions
            $this->error(
                'COMMENT_ERROR',
                $e->getMessage(),
                400,
                [
                    'component' => $component,
                    'commentarea' => $commentarea,
                    'error_code' => $e->getCode()
                ]
            );
        } catch (\Exception $e) {
            // Handle unexpected errors
            $this->error(
                'INTERNAL_ERROR',
                'Failed to add comment: ' . $e->getMessage(),
                500,
                [
                    'component' => $component,
                    'commentarea' => $commentarea
                ]
            );
        }
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new BlockCommentsEndpoint();
    $endpoint->execute();
}
