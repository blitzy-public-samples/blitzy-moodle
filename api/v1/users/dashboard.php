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
 * REST API endpoint for retrieving personalized user dashboard data.
 *
 * This endpoint aggregates data from multiple Moodle subsystems to provide
 * a comprehensive dashboard view including:
 * - Upcoming calendar events (next 7 days)
 * - Enrolled courses with progress information
 * - Unread message count
 * - Recent notifications
 * - Timeline of course activities
 * - Recent activity feed across enrolled courses
 *
 * CRITICAL PERMISSION ENFORCEMENT:
 * Users can ONLY view their own dashboard ($userid == $USER->id) unless they
 * have the moodle/site:config capability (site administrators). This strict
 * privacy rule ensures users cannot access dashboard data of other users.
 *
 * Optional query parameters allow clients to control which sections are included
 * in the response to optimize performance and reduce payload size when specific
 * sections are not needed.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Always load API base classes (needed for class definition)
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Prevent direct execution during testing
if (!defined('API_TEST_MODE')) {
    // Load Moodle configuration and required libraries
    require_once(__DIR__ . '/../../../public/config.php');
    require_login();
    
    global $CFG;
    require_once($CFG->dirroot . '/lib/moodlelib.php');
    require_once($CFG->dirroot . '/lib/enrollib.php');
    require_once($CFG->dirroot . '/calendar/lib.php');
    require_once($CFG->dirroot . '/message/lib.php');
    require_once($CFG->dirroot . '/blocks/myoverview/lib.php');
}

/**
 * Dashboard API endpoint class.
 *
 * Handles GET /api/v1/users/{id}/dashboard requests to retrieve aggregated
 * dashboard data for a specific user. Extends ApiBase to inherit JWT
 * authentication, request routing, and response formatting capabilities.
 */
class DashboardEndpoint extends ApiBase {
    
    /**
     * Handle GET request for user dashboard data.
     *
     * Aggregates personalized dashboard information from multiple Moodle subsystems
     * including calendar events, enrolled courses, messaging, notifications, and
     * recent activity. Enforces strict permission checking to ensure users can only
     * view their own dashboard unless they are site administrators.
     *
     * Query parameters:
     * - id (required, int): User ID to retrieve dashboard for
     * - includeEvents (optional, bool): Include upcoming calendar events (default: true)
     * - includeCourses (optional, bool): Include enrolled courses (default: true)
     * - includeMessages (optional, bool): Include message counts (default: true)
     * - includeNotifications (optional, bool): Include recent notifications (default: true)
     * - includeTimeline (optional, bool): Include course timeline (default: true)
     * - includeActivity (optional, bool): Include recent activity (default: true)
     *
     * Response format:
     * {
     *   "success": true,
     *   "data": {
     *     "upcomingEvents": [...],
     *     "enrolledCourses": [...],
     *     "messages": { "unread": N },
     *     "notifications": [...],
     *     "timeline": [...],
     *     "recentActivity": [...]
     *   }
     * }
     *
     * @return void Outputs JSON response directly
     * @throws NotFoundException If user does not exist or is deleted
     * @throws ForbiddenException If attempting to view another user's dashboard without permission
     * @throws ValidationException If user ID parameter is invalid
     */
    protected function handle_get() {
        global $DB, $USER;
        
        // Extract user ID from query parameter
        // This will be passed as ?id=123 in the URL
        $userid = $this->getParam('id', PARAM_INT, true);
        
        // Validate user ID is positive
        if ($userid <= 0) {
            throw new ValidationException('Invalid user ID', [
                'parameter' => 'id',
                'value' => $userid,
                'reason' => 'User ID must be a positive integer'
            ]);
        }
        
        // Retrieve authenticated user from JWT token
        $authenticatedUser = $this->getUser();
        
        // Validate that the requested user exists and is not deleted
        $targetUser = $DB->get_record('user', ['id' => $userid], '*', IGNORE_MISSING);
        
        if (!$targetUser) {
            throw new NotFoundException('User not found', [
                'userId' => $userid,
                'reason' => 'The requested user does not exist in the system'
            ]);
        }
        
        // Check if user is deleted
        if ($targetUser->deleted == 1) {
            throw new NotFoundException('User has been deleted', [
                'userId' => $userid,
                'reason' => 'The requested user account has been deleted'
            ]);
        }
        
        // CRITICAL PERMISSION CHECK:
        // Users can ONLY view their own dashboard unless they are site administrators
        $isSelf = ($userid == $authenticatedUser->id);
        $isAdmin = has_capability('moodle/site:config', context_system::instance(), $authenticatedUser->id);
        
        if (!$isSelf && !$isAdmin) {
            throw new ForbiddenException('You do not have permission to view this dashboard', [
                'requestedUserId' => $userid,
                'authenticatedUserId' => $authenticatedUser->id,
                'reason' => 'Users can only view their own dashboard unless they have site administration privileges',
                'requiredCapability' => 'moodle/site:config'
            ]);
        }
        
        // Extract optional query parameters to control which sections to include
        // These allow clients to optimize performance by excluding unneeded data
        $includeEvents = $this->getParam('includeEvents', PARAM_BOOL, false, true);
        $includeCourses = $this->getParam('includeCourses', PARAM_BOOL, false, true);
        $includeMessages = $this->getParam('includeMessages', PARAM_BOOL, false, true);
        $includeNotifications = $this->getParam('includeNotifications', PARAM_BOOL, false, true);
        $includeTimeline = $this->getParam('includeTimeline', PARAM_BOOL, false, true);
        $includeActivity = $this->getParam('includeActivity', PARAM_BOOL, false, true);
        
        // Build dashboard data structure
        $dashboard = [];
        
        // Aggregate data from each subsystem based on include parameters
        if ($includeEvents) {
            $dashboard['upcomingEvents'] = $this->getUpcomingEvents($userid);
        }
        
        if ($includeCourses) {
            $dashboard['enrolledCourses'] = $this->getEnrolledCourses($userid);
        }
        
        if ($includeMessages) {
            $dashboard['messages'] = $this->getMessageCounts($userid);
        }
        
        if ($includeNotifications) {
            $dashboard['notifications'] = $this->getNotifications($userid);
        }
        
        if ($includeTimeline) {
            $dashboard['timeline'] = $this->getTimeline($userid);
        }
        
        if ($includeActivity) {
            $dashboard['recentActivity'] = $this->getRecentActivity($userid);
        }
        
        // Return success response with aggregated dashboard data
        $this->success($dashboard, 200);
    }
    
    /**
     * Get upcoming calendar events for the user.
     *
     * Retrieves calendar events for the next 7 days using Moodle's calendar API.
     * Filters events based on user's calendar visibility preferences and course
     * enrollment. Only includes events the user has permission to view.
     *
     * @param int $userid User ID to get events for
     * @return array Array of upcoming event objects with: id, name, description, timestart, duration, courseid
     */
    private function getUpcomingEvents($userid) {
        global $DB;
        
        // Calculate time range (next 7 days)
        $timestart = time();
        $timeend = $timestart + (7 * 24 * 60 * 60); // 7 days from now
        
        try {
            // Use Moodle's calendar API to get events
            // This function respects calendar visibility settings and permissions
            $events = calendar_get_events($timestart, $timeend, $userid, false, false);
            
            if (!$events) {
                return [];
            }
            
            // Format events for API response
            $formattedEvents = [];
            
            foreach ($events as $event) {
                // Filter out events the user cannot see based on visibility settings
                if (!empty($event->visible) || $event->visible === null) {
                    $formattedEvents[] = [
                        'id' => $event->id,
                        'name' => $event->name,
                        'description' => $event->description ?? '',
                        'timestart' => $event->timestart,
                        'duration' => $event->timeduration ?? 0,
                        'courseid' => $event->courseid ?? null,
                        'eventtype' => $event->eventtype ?? 'user',
                        'url' => $event->url ?? '',
                    ];
                }
            }
            
            // Sort events by timestart (earliest first)
            usort($formattedEvents, function($a, $b) {
                return $a['timestart'] - $b['timestart'];
            });
            
            return $formattedEvents;
            
        } catch (Exception $e) {
            // If calendar retrieval fails, return empty array rather than breaking entire dashboard
            // Log error for debugging but don't expose to client
            error_log('Dashboard API: Failed to retrieve calendar events for user ' . $userid . ': ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Get enrolled courses with progress information for the user.
     *
     * Retrieves all courses the user is enrolled in using Moodle's enrollment API.
     * Includes course progress data, enrollment status, and access information.
     * Filters out courses the user no longer has access to or are hidden.
     *
     * @param int $userid User ID to get courses for
     * @return array Array of course objects with: id, fullname, shortname, progress, visible, enrolled
     */
    private function getEnrolledCourses($userid) {
        global $DB;
        
        try {
            // Use Moodle's enrolment API to get all courses user is enrolled in
            // This function respects enrolment status and visibility settings
            $courses = enrol_get_users_courses($userid, true, ['id', 'fullname', 'shortname', 'visible', 'startdate', 'enddate', 'category']);
            
            if (!$courses) {
                return [];
            }
            
            $formattedCourses = [];
            
            foreach ($courses as $course) {
                // Get course context for permission checks
                $context = context_course::instance($course->id);
                
                // Check if user still has access to the course
                // This handles suspended enrollments, time restrictions, etc.
                $canAccess = is_enrolled($context, $userid, '', true);
                
                if (!$canAccess) {
                    continue; // Skip courses user cannot access
                }
                
                // Calculate course completion progress if completion is enabled
                $progress = 0;
                if (completion_info::is_enabled_for_site()) {
                    require_once(__DIR__ . '/../../../lib/completionlib.php');
                    $completionInfo = new completion_info($course);
                    if ($completionInfo->is_enabled()) {
                        // Get completion percentage for this user
                        $percentage = \core_completion\progress::get_course_progress_percentage($course, $userid);
                        if ($percentage !== null) {
                            $progress = round($percentage);
                        }
                    }
                }
                
                $formattedCourses[] = [
                    'id' => $course->id,
                    'fullname' => $course->fullname,
                    'shortname' => $course->shortname,
                    'visible' => (bool)$course->visible,
                    'progress' => $progress,
                    'startdate' => $course->startdate ?? 0,
                    'enddate' => $course->enddate ?? 0,
                    'categoryid' => $course->category ?? 0,
                ];
            }
            
            // Filter out hidden courses if user doesn't have capability to view them
            $formattedCourses = array_filter($formattedCourses, function($course) use ($userid) {
                if (!$course['visible']) {
                    // Check if user can view hidden courses
                    $context = context_course::instance($course['id']);
                    return has_capability('moodle/course:viewhiddencourses', $context, $userid);
                }
                return true;
            });
            
            // Re-index array after filtering to ensure sequential numeric keys
            return array_values($formattedCourses);
            
        } catch (Exception $e) {
            // If course retrieval fails, return empty array
            error_log('Dashboard API: Failed to retrieve enrolled courses for user ' . $userid . ': ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Get message counts for the user.
     *
     * Retrieves counts of unread messages and conversations using Moodle's
     * messaging API. Includes total unread count and count of unread conversations.
     *
     * @param int $userid User ID to get message counts for
     * @return array Array with keys: unread (int), unreadConversations (int)
     */
    private function getMessageCounts($userid) {
        try {
            // Use Moodle's messaging API to count unread messages
            // This function handles all message types and privacy settings
            $unreadCount = message_count_unread_messages($userid);
            
            // Count unread conversations
            $unreadConversations = \core_message\api::count_unread_conversations($userid);
            
            return [
                'unread' => $unreadCount ?? 0,
                'unreadConversations' => $unreadConversations ?? 0,
            ];
            
        } catch (Exception $e) {
            // If message count fails, return zero counts
            error_log('Dashboard API: Failed to retrieve message counts for user ' . $userid . ': ' . $e->getMessage());
            return [
                'unread' => 0,
                'unreadConversations' => 0,
            ];
        }
    }
    
    /**
     * Get recent notifications for the user.
     *
     * Retrieves popup notifications from the last 7 days using Moodle's
     * notification system. Filters out deleted or suspended notifications
     * and respects user notification preferences.
     *
     * @param int $userid User ID to get notifications for
     * @return array Array of notification objects with: id, subject, message, timecreated, read
     */
    private function getNotifications($userid) {
        global $DB;
        
        try {
            // Get notifications from last 7 days
            $timecutoff = time() - (7 * 24 * 60 * 60);
            
            // Use Moodle's messaging API to get popup notifications
            // This respects user preferences and notification settings
            $notifications = \core_message\api::get_popup_notifications($userid);
            
            if (!$notifications) {
                return [];
            }
            
            $formattedNotifications = [];
            
            foreach ($notifications as $notification) {
                // Filter by time (only last 7 days)
                if ($notification->timecreated < $timecutoff) {
                    continue;
                }
                
                $formattedNotifications[] = [
                    'id' => $notification->id,
                    'subject' => $notification->subject ?? '',
                    'message' => $notification->fullmessage ?? $notification->smallmessage ?? '',
                    'timecreated' => $notification->timecreated,
                    'read' => isset($notification->timeread) && $notification->timeread > 0,
                    'component' => $notification->component ?? 'moodle',
                    'eventtype' => $notification->eventtype ?? 'notification',
                ];
            }
            
            // Sort by time created (most recent first)
            usort($formattedNotifications, function($a, $b) {
                return $b['timecreated'] - $a['timecreated'];
            });
            
            // Limit to 20 most recent notifications
            return array_slice($formattedNotifications, 0, 20);
            
        } catch (Exception $e) {
            // If notification retrieval fails, return empty array
            error_log('Dashboard API: Failed to retrieve notifications for user ' . $userid . ': ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Get course timeline data for the user.
     *
     * Retrieves sorted course activities and upcoming deadlines using the
     * block_myoverview API. Includes assignments, quizzes, and other activities
     * with due dates in the near future.
     *
     * @param int $userid User ID to get timeline for
     * @return array Array of timeline item objects with: courseid, modulename, activityname, duedate
     */
    private function getTimeline($userid) {
        global $DB;
        
        try {
            // Get sorted courses for the user (includes timeline information)
            // This uses the My Overview block's logic which aggregates activities
            $courses = block_myoverview_get_sorted_courses($userid);
            
            if (!$courses) {
                return [];
            }
            
            $timeline = [];
            
            // For each course, get upcoming activities with due dates
            foreach ($courses as $course) {
                $courseid = $course->id;
                $context = context_course::instance($courseid);
                
                // Check if user can access course
                if (!is_enrolled($context, $userid, '', true)) {
                    continue;
                }
                
                // Get course modules with completion tracking or due dates
                $modinfo = get_fast_modinfo($courseid, $userid);
                $now = time();
                $futureLimit = $now + (30 * 24 * 60 * 60); // Next 30 days
                
                foreach ($modinfo->get_cms() as $cm) {
                    // Skip if user cannot access this module
                    if (!$cm->uservisible) {
                        continue;
                    }
                    
                    // Check for completion expected date or due date
                    $duedate = null;
                    
                    if ($cm->completionexpected > 0 && $cm->completionexpected >= $now && $cm->completionexpected <= $futureLimit) {
                        $duedate = $cm->completionexpected;
                    }
                    
                    // Also check module-specific due dates (assignments, quizzes)
                    if (!$duedate && in_array($cm->modname, ['assign', 'quiz', 'workshop', 'lesson'])) {
                        $instance = $DB->get_record($cm->modname, ['id' => $cm->instance], 'duedate');
                        if ($instance && !empty($instance->duedate) && $instance->duedate >= $now && $instance->duedate <= $futureLimit) {
                            $duedate = $instance->duedate;
                        }
                    }
                    
                    if ($duedate) {
                        $timeline[] = [
                            'courseid' => $courseid,
                            'coursename' => $course->fullname,
                            'modulename' => $cm->modname,
                            'activityname' => $cm->name,
                            'activityid' => $cm->id,
                            'duedate' => $duedate,
                            'url' => $cm->url ? $cm->url->out(false) : '',
                        ];
                    }
                }
            }
            
            // Sort timeline by due date (earliest first)
            usort($timeline, function($a, $b) {
                return $a['duedate'] - $b['duedate'];
            });
            
            // Limit to 20 most urgent items
            return array_slice($timeline, 0, 20);
            
        } catch (Exception $e) {
            // If timeline retrieval fails, return empty array
            error_log('Dashboard API: Failed to retrieve timeline for user ' . $userid . ': ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Get recent activity feed across all enrolled courses.
     *
     * Aggregates recent activities from all courses the user is enrolled in,
     * including new forum posts, assignment submissions, grade updates, and
     * other relevant course events from the last 7 days.
     *
     * @param int $userid User ID to get recent activity for
     * @return array Array of activity objects with: courseid, type, description, timecreated, url
     */
    private function getRecentActivity($userid) {
        global $DB;
        
        try {
            // Get all enrolled courses
            $courses = enrol_get_users_courses($userid, true, ['id', 'fullname']);
            
            if (!$courses) {
                return [];
            }
            
            $activities = [];
            $timecutoff = time() - (7 * 24 * 60 * 60); // Last 7 days
            
            // For each course, get recent activity
            foreach ($courses as $course) {
                $context = context_course::instance($course->id);
                
                // Skip if user cannot access course
                if (!is_enrolled($context, $userid, '', true)) {
                    continue;
                }
                
                // Get recent forum posts in this course
                $forumposts = $DB->get_records_sql(
                    "SELECT fp.id, fp.subject, fp.created, fd.name as discussionname, f.name as forumname
                     FROM {forum_posts} fp
                     JOIN {forum_discussions} fd ON fp.discussion = fd.id
                     JOIN {forum} f ON fd.forum = f.id
                     WHERE f.course = :courseid 
                       AND fp.created >= :timecutoff
                       AND fp.userid != :userid
                     ORDER BY fp.created DESC
                     LIMIT 5",
                    [
                        'courseid' => $course->id,
                        'timecutoff' => $timecutoff,
                        'userid' => $userid
                    ]
                );
                
                foreach ($forumposts as $post) {
                    $activities[] = [
                        'courseid' => $course->id,
                        'coursename' => $course->fullname,
                        'type' => 'forum_post',
                        'description' => "New forum post: {$post->subject}",
                        'timecreated' => $post->created,
                        'url' => new moodle_url('/mod/forum/discuss.php', ['d' => $post->id]),
                    ];
                }
                
                // Get recent grade updates for this user
                $grades = $DB->get_records_sql(
                    "SELECT gg.id, gg.finalgrade, gg.timemodified, gi.itemname, gi.itemmodule
                     FROM {grade_grades} gg
                     JOIN {grade_items} gi ON gg.itemid = gi.id
                     WHERE gi.courseid = :courseid
                       AND gg.userid = :userid
                       AND gg.timemodified >= :timecutoff
                       AND gg.finalgrade IS NOT NULL
                     ORDER BY gg.timemodified DESC
                     LIMIT 5",
                    [
                        'courseid' => $course->id,
                        'userid' => $userid,
                        'timecutoff' => $timecutoff
                    ]
                );
                
                foreach ($grades as $grade) {
                    $activities[] = [
                        'courseid' => $course->id,
                        'coursename' => $course->fullname,
                        'type' => 'grade',
                        'description' => "Grade updated: {$grade->itemname}",
                        'timecreated' => $grade->timemodified,
                        'url' => new moodle_url('/grade/report/user/index.php', ['id' => $course->id]),
                    ];
                }
            }
            
            // Sort all activities by time (most recent first)
            usort($activities, function($a, $b) {
                return $b['timecreated'] - $a['timecreated'];
            });
            
            // Limit to 20 most recent activities
            $activities = array_slice($activities, 0, 20);
            
            // Convert moodle_url objects to strings for JSON serialization
            foreach ($activities as &$activity) {
                if (isset($activity['url']) && $activity['url'] instanceof moodle_url) {
                    $activity['url'] = $activity['url']->out(false);
                }
            }
            
            return $activities;
            
        } catch (Exception $e) {
            // If recent activity retrieval fails, return empty array
            error_log('Dashboard API: Failed to retrieve recent activity for user ' . $userid . ': ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Handle unsupported POST method.
     *
     * Dashboard endpoint only supports GET requests. POST is not allowed
     * as dashboard data is read-only.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for dashboard endpoint', [
            'allowedMethods' => ['GET'],
            'reason' => 'Dashboard data is read-only'
        ]);
    }
    
    /**
     * Handle unsupported PUT method.
     *
     * Dashboard endpoint only supports GET requests. PUT is not allowed
     * as dashboard data is read-only.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for dashboard endpoint', [
            'allowedMethods' => ['GET'],
            'reason' => 'Dashboard data is read-only'
        ]);
    }
    
    /**
     * Handle unsupported DELETE method.
     *
     * Dashboard endpoint only supports GET requests. DELETE is not allowed
     * as dashboard data is read-only.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for dashboard endpoint', [
            'allowedMethods' => ['GET'],
            'reason' => 'Dashboard data is read-only'
        ]);
    }
}

// Instantiate and execute the endpoint (only if not in test mode)
if (!defined('API_TEST_MODE')) {
    $endpoint = new DashboardEndpoint();
    $endpoint->execute();
}
