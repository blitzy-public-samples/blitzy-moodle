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
 * REST API endpoint for retrieving forum details and metadata.
 *
 * Implements GET /api/v1/forums/{id} to fetch complete forum information
 * including forum configuration, user-specific settings (subscription, tracking),
 * discussion counts, and user capabilities. Authenticates via JWT token and
 * enforces forum access permissions before returning data.
 *
 * Response includes comprehensive forum metadata:
 * - Core forum fields: id, course, name, intro, type, assessed, scale, etc.
 * - User-specific data: subscription status, tracking enabled, unread count
 * - User capabilities: can_start_discussion, can_reply_to_post, can_view_subscribers, can_manage_subscriptions
 * - Statistics: discussion count
 * - Course module info: visibility, completion settings
 *
 * This endpoint delegates all business logic to existing Moodle functions
 * without duplicating permission checks, subscription logic, or tracking
 * calculations. It serves as a thin wrapper that formats existing data
 * for consumption by the React frontend.
 *
 * @package    api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/moodlelib.php');
require_once($CFG->dirroot . '/mod/forum/lib.php');
require_once($CFG->dirroot . '/lib/accesslib.php');

// Load API utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Forum show endpoint - retrieves forum details for authenticated user.
 *
 * Extends ApiBase to leverage JWT authentication, request routing, and
 * response formatting. Implements handle_get() to process GET requests
 * for forum data, enriching core forum records with user-specific metadata.
 *
 * URL Pattern: GET /api/v1/forums/{id}
 * Example: GET /api/v1/forums/123
 *
 * Response Structure:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "course": 5,
 *     "type": "general",
 *     "name": "General forum",
 *     "intro": "This is a general forum...",
 *     "subscriptionStatus": "subscribed",
 *     "trackingEnabled": true,
 *     "trackingForced": false,
 *     "unreadCount": 5,
 *     "discussionCount": 42,
 *     "capabilities": {
 *       "canStartDiscussion": true,
 *       "canReplyToPost": true,
 *       "canViewSubscribers": false,
 *       "canManageSubscriptions": true
 *     },
 *     "courseModule": {
 *       "id": 456,
 *       "visible": true,
 *       "completion": 0
 *     }
 *   }
 * }
 */
class ForumShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request for forum details.
     *
     * Processes GET requests to retrieve comprehensive forum information:
     * 1. Extracts forum ID from URL path using regex pattern matching
     * 2. Validates forum ID is a positive integer
     * 3. Retrieves forum record from database
     * 4. Gets associated course module and context
     * 5. Checks user has permission to view forum discussions
     * 6. Enriches forum data with user-specific metadata:
     *    - Subscription status (subscribed/unsubscribed)
     *    - Tracking settings (enabled, forced, user's choice)
     *    - Unread post count for this user
     *    - User capabilities (start discussion, reply, view subscribers, etc.)
     *    - Discussion count respecting group mode and visibility
     * 7. Includes course module metadata (visibility, completion)
     * 8. Returns formatted JSON response
     *
     * All business logic is delegated to existing Moodle functions:
     * - $DB->get_record() for database queries
     * - get_coursemodule_from_instance() for course module data
     * - context_module::instance() for context creation
     * - require_capability() for permission enforcement
     * - \mod_forum\subscriptions::is_subscribed() for subscription status
     * - forum_tp_* functions for tracking functionality
     * - has_capability() for capability checks
     * - forum_count_discussions() for discussion count
     *
     * @return void Outputs JSON response via ApiResponse
     * @throws ValidationException If forum ID is invalid or missing
     * @throws NotFoundException If forum does not exist
     * @throws ForbiddenException If user lacks view permission
     * @throws UnauthorizedException If user is not authenticated
     */
    protected function handle_get() {
        global $DB, $USER;
        
        // Ensure user is authenticated
        $user = $this->getUser();
        
        // Extract forum ID from request URI using regex
        // Expected pattern: /api/v1/forums/123 or /api/v1/forums/123/
        $pattern = '/\/forums\/(\d+)\/?$/';
        $matches = [];
        
        if (!preg_match($pattern, $this->requestUri, $matches)) {
            throw new ValidationException('Invalid forum URL format', [
                'expectedFormat' => '/api/v1/forums/{id}',
                'receivedUri' => $this->requestUri,
                'reason' => 'Forum ID must be provided in URL path'
            ]);
        }
        
        // Extract and validate forum ID
        $forumid = $matches[1];
        
        // Validate forum ID is a positive integer
        if (!is_numeric($forumid) || intval($forumid) <= 0) {
            throw new ValidationException('Invalid forum ID', [
                'forumId' => $forumid,
                'reason' => 'Forum ID must be a positive integer'
            ]);
        }
        
        $forumid = intval($forumid);
        
        // Retrieve forum record from database
        $forum = $DB->get_record('forum', ['id' => $forumid]);
        
        if (!$forum) {
            throw new NotFoundException('Forum not found', [
                'forumId' => $forumid,
                'reason' => 'No forum exists with this ID'
            ]);
        }
        
        // Get course module for this forum
        try {
            $cm = get_coursemodule_from_instance('forum', $forum->id, $forum->course);
        } catch (Exception $e) {
            throw new NotFoundException('Forum course module not found', [
                'forumId' => $forum->id,
                'courseId' => $forum->course,
                'reason' => 'Course module configuration is missing',
                'originalError' => $e->getMessage()
            ]);
        }
        
        if (!$cm) {
            throw new NotFoundException('Forum course module not found', [
                'forumId' => $forum->id,
                'courseId' => $forum->course,
                'reason' => 'Course module not configured for this forum'
            ]);
        }
        
        // Get course record
        $course = $DB->get_record('course', ['id' => $forum->course], '*', MUST_EXIST);
        
        // Get module context for capability checking
        $context = context_module::instance($cm->id);
        
        // Check if user can view this forum
        // This enforces Moodle's existing permission system
        try {
            require_capability('mod/forum:viewdiscussion', $context, $user->id);
        } catch (moodle_exception $e) {
            throw new ForbiddenException('You do not have permission to view this forum', [
                'requiredCapability' => 'mod/forum:viewdiscussion',
                'forumId' => $forum->id,
                'contextId' => $context->id,
                'userId' => $user->id,
                'errorCode' => $e->errorcode
            ]);
        }
        
        // Check if course module is visible
        // If not visible and user doesn't have viewhiddenactivities capability, deny access
        if (!$cm->visible) {
            if (!has_capability('moodle/course:viewhiddenactivities', $context, $user->id)) {
                throw new NotFoundException('Forum not found', [
                    'forumId' => $forum->id,
                    'reason' => 'Forum is hidden and user cannot view hidden activities'
                ]);
            }
        }
        
        // Build enriched forum data object
        $forumdata = new stdClass();
        
        // Copy all core forum properties
        $forumdata->id = $forum->id;
        $forumdata->course = $forum->course;
        $forumdata->type = $forum->type;
        $forumdata->name = $forum->name;
        $forumdata->intro = $forum->intro;
        $forumdata->introformat = $forum->introformat;
        $forumdata->assessed = $forum->assessed;
        $forumdata->assesstimestart = $forum->assesstimestart ?? 0;
        $forumdata->assesstimefinish = $forum->assesstimefinish ?? 0;
        $forumdata->scale = $forum->scale ?? 0;
        $forumdata->maxbytes = $forum->maxbytes ?? 0;
        $forumdata->maxattachments = $forum->maxattachments ?? 1;
        $forumdata->forcesubscribe = $forum->forcesubscribe ?? FORUM_CHOOSESUBSCRIBE;
        $forumdata->trackingtype = $forum->trackingtype ?? FORUM_TRACKING_OPTIONAL;
        $forumdata->rsstype = $forum->rsstype ?? 0;
        $forumdata->rssarticles = $forum->rssarticles ?? 0;
        $forumdata->timemodified = $forum->timemodified;
        $forumdata->warnafter = $forum->warnafter ?? 0;
        $forumdata->blockafter = $forum->blockafter ?? 0;
        $forumdata->blockperiod = $forum->blockperiod ?? 0;
        $forumdata->completiondiscussions = $forum->completiondiscussions ?? 0;
        $forumdata->completionreplies = $forum->completionreplies ?? 0;
        $forumdata->completionposts = $forum->completionposts ?? 0;
        
        // Add user-specific subscription status
        // Use Moodle's subscription management class
        $forumdata->isSubscribed = \mod_forum\subscriptions::is_subscribed($user->id, $forum, null, $cm);
        
        // Determine subscription mode
        $subscriptionMode = 'optional';
        if ($forum->forcesubscribe == FORUM_FORCESUBSCRIBE) {
            $subscriptionMode = 'forced';
        } elseif ($forum->forcesubscribe == FORUM_INITIALSUBSCRIBE) {
            $subscriptionMode = 'initial';
        } elseif ($forum->forcesubscribe == FORUM_DISALLOWSUBSCRIBE) {
            $subscriptionMode = 'disabled';
        }
        $forumdata->subscriptionMode = $subscriptionMode;
        
        // Add tracking information
        // Check if tracking is available for this forum
        $forumdata->trackingEnabled = forum_tp_can_track_forums($forum, $user);
        
        // Check if tracking is forced
        $forumdata->trackingForced = ($forum->trackingtype == FORUM_TRACKING_FORCED);
        
        // Check if this specific user has tracking enabled
        $forumdata->isTracked = forum_tp_is_tracked($forum, $user);
        
        // Get unread post count for this user if tracking is enabled
        $forumdata->unreadCount = 0;
        if ($forumdata->isTracked) {
            try {
                $unreadcount = forum_tp_count_forum_unread_posts($cm, $course);
                // The function returns an object with forum ID as key
                if (isset($unreadcount[$forum->id])) {
                    $forumdata->unreadCount = $unreadcount[$forum->id]->unread ?? 0;
                }
            } catch (Exception $e) {
                // If unread count fails, default to 0 but don't fail the entire request
                $forumdata->unreadCount = 0;
            }
        }
        
        // Get discussion count for this forum
        try {
            $forumdata->discussionCount = forum_count_discussions($forum, $cm, $course);
        } catch (Exception $e) {
            // If count fails, default to 0
            $forumdata->discussionCount = 0;
        }
        
        // Add user capabilities for this forum
        $capabilities = new stdClass();
        $capabilities->canStartDiscussion = has_capability('mod/forum:startdiscussion', $context, $user->id);
        $capabilities->canReplyToPost = has_capability('mod/forum:replypost', $context, $user->id);
        $capabilities->canViewSubscribers = has_capability('mod/forum:viewsubscribers', $context, $user->id);
        $capabilities->canManageSubscriptions = has_capability('mod/forum:managesubscriptions', $context, $user->id);
        $capabilities->canAddDiscussion = has_capability('mod/forum:addquestion', $context, $user->id) ||
                                         has_capability('mod/forum:startdiscussion', $context, $user->id);
        $capabilities->canAddNews = has_capability('mod/forum:addnews', $context, $user->id);
        $capabilities->canViewAnyRating = has_capability('mod/forum:viewanyrating', $context, $user->id);
        $capabilities->canViewRating = has_capability('mod/forum:viewrating', $context, $user->id);
        $capabilities->canRate = has_capability('mod/forum:rate', $context, $user->id);
        $capabilities->canCreateAttachment = has_capability('mod/forum:createattachment', $context, $user->id);
        $capabilities->canDeleteOwnPost = has_capability('mod/forum:deleteownpost', $context, $user->id);
        $capabilities->canDeleteAnyPost = has_capability('mod/forum:deleteanypost', $context, $user->id);
        $capabilities->canEditAnyPost = has_capability('mod/forum:editanypost', $context, $user->id);
        $capabilities->canSplitDiscussions = has_capability('mod/forum:splitdiscussions', $context, $user->id);
        $capabilities->canMoveDiscussions = has_capability('mod/forum:movediscussions', $context, $user->id);
        $capabilities->canPinDiscussions = has_capability('mod/forum:pindiscussions', $context, $user->id);
        $capabilities->canExportDiscussion = has_capability('mod/forum:exportdiscussion', $context, $user->id);
        $capabilities->canExportPost = has_capability('mod/forum:exportpost', $context, $user->id);
        $capabilities->canExportOwnPost = has_capability('mod/forum:exportownpost', $context, $user->id);
        
        $forumdata->capabilities = $capabilities;
        
        // Add course module information
        $courseModule = new stdClass();
        $courseModule->id = $cm->id;
        $courseModule->module = $cm->module;
        $courseModule->instance = $cm->instance;
        $courseModule->section = $cm->section;
        $courseModule->visible = $cm->visible;
        $courseModule->groupmode = $cm->groupmode;
        $courseModule->groupingid = $cm->groupingid;
        $courseModule->completion = $cm->completion;
        $courseModule->completionview = $cm->completionview ?? 0;
        $courseModule->completionexpected = $cm->completionexpected ?? 0;
        $courseModule->availability = $cm->availability ?? null;
        
        $forumdata->courseModule = $courseModule;
        
        // Add course information
        $courseInfo = new stdClass();
        $courseInfo->id = $course->id;
        $courseInfo->fullname = $course->fullname;
        $courseInfo->shortname = $course->shortname;
        $courseInfo->format = $course->format;
        
        $forumdata->courseInfo = $courseInfo;
        
        // Return success response with enriched forum data
        $this->success($forumdata, 200);
    }
    
    /**
     * Handle POST requests - not supported for forum show endpoint.
     *
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for forum show endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/forums/{id}'
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for forum show endpoint.
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for forum show endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/forums/{id}'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for forum show endpoint.
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for forum show endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/forums/{id}'
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new ForumShowEndpoint();
$endpoint->execute();
