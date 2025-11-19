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
 * REST API endpoint for recent activity block data.
 *
 * Handles GET /api/v1/blocks/recent to return recent activity widget data
 * for React course dashboard. Aggregates recent course activities including
 * completions, new posts, submissions, grades, and resource changes within
 * specified time period (default 24 hours or since last course access).
 *
 * Endpoint accepts:
 * - courseid (required): Course ID to fetch recent activity for
 * - timestart (optional): Unix timestamp for activity since (default: last access or 24h ago)
 *
 * Returns JSON array of activity objects with:
 * - type: Activity type (completion/post/submission/grade/resource/structural)
 * - name: Activity or resource name
 * - actor: User information (id, fullname, profileimageurl)
 * - timestamp: Unix timestamp of activity
 * - action: Action performed (added/modified/completed/submitted/graded/posted)
 * - url: Navigation URL to activity
 * - module_type: Activity module type (assign/forum/quiz/resource etc.)
 * - icon_url: Icon for activity type
 *
 * Enforces moodle/course:view capability check in course context.
 * Uses existing Moodle activity tracking with zero business logic duplication.
 *
 * @package    api
 * @subpackage blocks
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and API base class
require_once(__DIR__ . '/../../lib/api_base.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->libdir . '/completionlib.php');
require_once($CFG->dirroot . '/blocks/recent_activity/lib.php');

/**
 * Recent Activity Block API Endpoint.
 *
 * Provides recent activity data for course dashboard widgets in React frontend.
 * Aggregates activity completions, forum posts, assignment submissions, grade changes,
 * and structural modifications (added/updated/deleted resources) within specified time period.
 */
class RecentActivityEndpoint extends ApiBase {
    
    /**
     * Maximum number of activity items to return
     */
    const MAX_ACTIVITIES = 50;
    
    /**
     * Default lookback period in seconds (24 hours)
     */
    const DEFAULT_LOOKBACK = 86400;
    
    /**
     * Handle GET request to fetch recent activity data.
     *
     * Required parameters:
     * - courseid: Course ID to fetch activities for
     *
     * Optional parameters:
     * - timestart: Unix timestamp for activity since (default: user's last course access or 24 hours ago)
     *
     * Returns:
     * - success: Boolean indicating success
     * - data: Object containing:
     *   - activities: Array of activity objects sorted by timestamp descending
     *   - course: Course information (id, fullname, shortname)
     *   - time_period: Object with start and end timestamps
     *   - total: Total number of activities returned
     *   - grouped: Activities grouped by type for easier rendering
     *
     * @return void Outputs JSON response
     * @throws ValidationException If courseid is invalid
     * @throws NotFoundException If course doesn't exist
     * @throws ForbiddenException If user lacks moodle/course:view capability
     */
    protected function handle_get() {
        global $DB, $CFG, $OUTPUT;
        
        // Get authenticated user
        $user = $this->getUser();
        
        // Extract and validate parameters
        $courseid = $this->getParam('courseid', PARAM_INT, true);
        $timestart = $this->getParam('timestart', PARAM_INT, false, null);
        
        // Validate course exists
        try {
            $course = get_course($courseid);
        } catch (Exception $e) {
            $this->error(
                'COURSE_NOT_FOUND',
                "Course with ID {$courseid} not found",
                404,
                ['courseid' => $courseid]
            );
            return;
        }
        
        // Check capability to view course
        $context = context_course::instance($courseid);
        $this->checkCapability('moodle/course:view', $context);
        
        // Determine time period for recent activity
        if ($timestart === null) {
            // Use user's last course access if available, otherwise 24 hours ago
            $timestart = $this->getDefaultTimestart($user->id, $courseid);
        }
        
        // Ensure timestart is not in the future
        if ($timestart > time()) {
            $timestart = time() - self::DEFAULT_LOOKBACK;
        }
        
        $timeend = time();
        
        // Initialize activities array
        $allActivities = [];
        
        // Fetch different types of recent activity
        try {
            // 1. Get structural changes (added/updated/deleted modules)
            $structuralChanges = $this->getStructuralChanges($course, $context, $timestart);
            $allActivities = array_merge($allActivities, $structuralChanges);
            
            // 2. Get activity completions
            $completions = $this->getActivityCompletions($courseid, $timestart);
            $allActivities = array_merge($allActivities, $completions);
            
            // 3. Get module-specific recent activity (forum posts, assignments, etc.)
            $moduleActivities = $this->getModuleRecentActivity($course, $timestart);
            $allActivities = array_merge($allActivities, $moduleActivities);
            
            // 4. Get recent grade changes
            $gradeChanges = $this->getRecentGradeChanges($courseid, $timestart);
            $allActivities = array_merge($allActivities, $gradeChanges);
            
        } catch (Exception $e) {
            $this->error(
                'ACTIVITY_FETCH_ERROR',
                'Failed to fetch recent activity data',
                500,
                ['message' => $e->getMessage()]
            );
            return;
        }
        
        // Sort all activities by timestamp descending (most recent first)
        usort($allActivities, function($a, $b) {
            return $b['timestamp'] - $a['timestamp'];
        });
        
        // Limit to maximum number of activities
        $allActivities = array_slice($allActivities, 0, self::MAX_ACTIVITIES);
        
        // Group activities by type for easier frontend rendering
        $groupedActivities = $this->groupActivitiesByType($allActivities);
        
        // Prepare course information
        $courseInfo = [
            'id' => $course->id,
            'fullname' => $course->fullname,
            'shortname' => $course->shortname,
        ];
        
        // Prepare response data
        $responseData = [
            'activities' => $allActivities,
            'course' => $courseInfo,
            'time_period' => [
                'start' => $timestart,
                'end' => $timeend,
            ],
            'total' => count($allActivities),
            'grouped' => $groupedActivities,
        ];
        
        // Send success response
        $this->success($responseData, 200);
    }
    
    /**
     * Get default timestart based on user's last course access.
     *
     * Uses user's last course access timestamp if available, otherwise
     * returns current time minus DEFAULT_LOOKBACK (24 hours).
     *
     * @param int $userid   User ID
     * @param int $courseid Course ID
     * @return int Unix timestamp
     */
    private function getDefaultTimestart($userid, $courseid) {
        global $DB;
        
        // Try to get user's last course access
        $lastaccess = $DB->get_field(
            'user_lastaccess',
            'timeaccess',
            ['userid' => $userid, 'courseid' => $courseid]
        );
        
        if ($lastaccess) {
            return $lastaccess;
        }
        
        // Fall back to 24 hours ago
        return time() - self::DEFAULT_LOOKBACK;
    }
    
    /**
     * Get structural changes in course (added/updated/deleted modules).
     *
     * Queries the block_recent_activity table for course module changes.
     * Returns activities with action types: 'add mod', 'update mod', 'delete mod'.
     *
     * @param object  $course   Course object
     * @param context $context  Course context
     * @param int     $timestart Unix timestamp to fetch changes since
     * @return array Array of activity objects
     */
    private function getStructuralChanges($course, $context, $timestart) {
        global $DB;
        
        $activities = [];
        
        // Check if user has capability to view structural changes
        $canViewDeleted = has_capability('block/recent_activity:viewdeletemodule', $context);
        $canViewUpdated = has_capability('block/recent_activity:viewaddupdatemodule', $context);
        
        if (!$canViewDeleted && !$canViewUpdated) {
            return $activities;
        }
        
        // Query block_recent_activity table for changes
        $sql = "SELECT
                    cmid, MIN(action) AS minaction, MAX(action) AS maxaction,
                    MAX(modname) AS modname, MAX(timecreated) AS timecreated,
                    MAX(userid) AS userid
                FROM {block_recent_activity}
                WHERE timecreated > :timestart AND courseid = :courseid
                GROUP BY cmid
                ORDER BY MAX(timecreated) DESC";
        
        $params = ['timestart' => $timestart, 'courseid' => $course->id];
        $logs = $DB->get_records_sql($sql, $params);
        
        if ($logs) {
            $modinfo = get_fast_modinfo($course);
            $modnames = get_module_types_names();
            
            foreach ($logs as $log) {
                // Constants: CM_CREATED = 0, CM_UPDATED = 1, CM_DELETED = 2
                $wasDeleted = ($log->maxaction == 2);
                $wasCreated = ($log->minaction == 0);
                
                // Skip if activity was created and deleted in same period
                if ($wasDeleted && $wasCreated) {
                    continue;
                }
                
                if ($wasDeleted && $canViewDeleted) {
                    // Module was deleted
                    $activities[] = [
                        'activity_type' => 'structural',
                        'activity_name' => isset($modnames[$log->modname]) ? $modnames[$log->modname] : $log->modname,
                        'module_name' => $log->modname,
                        'module_type' => $log->modname,
                        'user_info' => $this->getUserInfo($log->userid),
                        'timestamp' => $log->timecreated,
                        'action' => 'deleted',
                        'course_section' => null,
                        'activity_url' => null,
                        'icon_url' => null,
                    ];
                    
                } else if (!$wasDeleted && isset($modinfo->cms[$log->cmid]) && $canViewUpdated) {
                    // Module was added or updated
                    $cm = $modinfo->cms[$log->cmid];
                    
                    if ($cm->has_view() && $cm->uservisible) {
                        $activities[] = [
                            'activity_type' => 'structural',
                            'activity_name' => $cm->name,
                            'module_name' => $cm->modname,
                            'module_type' => $cm->modname,
                            'user_info' => $this->getUserInfo($log->userid),
                            'timestamp' => $log->timecreated,
                            'action' => $wasCreated ? 'added' : 'modified',
                            'course_section' => $cm->sectionnum,
                            'activity_url' => $cm->url ? $cm->url->out(false) : null,
                            'icon_url' => $cm->get_icon_url()->out(false),
                        ];
                    }
                }
            }
        }
        
        return $activities;
    }
    
    /**
     * Get recent activity completions.
     *
     * Queries course_modules_completion table for recently completed activities.
     *
     * @param int $courseid  Course ID
     * @param int $timestart Unix timestamp to fetch completions since
     * @return array Array of activity objects
     */
    private function getActivityCompletions($courseid, $timestart) {
        global $DB;
        
        $activities = [];
        
        // Query for recent completions
        $sql = "SELECT cmc.id, cmc.userid, cmc.coursemoduleid, cmc.timemodified,
                       cm.instance, m.name as modname, cs.name as activityname
                FROM {course_modules_completion} cmc
                JOIN {course_modules} cm ON cm.id = cmc.coursemoduleid
                JOIN {modules} m ON m.id = cm.module
                LEFT JOIN {assign} cs ON cs.id = cm.instance AND m.name = 'assign'
                WHERE cmc.timemodified > :timestart
                  AND cm.course = :courseid
                  AND cmc.completionstate > 0
                ORDER BY cmc.timemodified DESC
                LIMIT 50";
        
        $params = ['timestart' => $timestart, 'courseid' => $courseid];
        $completions = $DB->get_records_sql($sql, $params);
        
        if ($completions) {
            $modinfo = get_fast_modinfo($courseid);
            
            foreach ($completions as $completion) {
                if (isset($modinfo->cms[$completion->coursemoduleid])) {
                    $cm = $modinfo->cms[$completion->coursemoduleid];
                    
                    if ($cm->uservisible) {
                        $activities[] = [
                            'activity_type' => 'completion',
                            'activity_name' => $cm->name,
                            'module_name' => $completion->modname,
                            'module_type' => $completion->modname,
                            'user_info' => $this->getUserInfo($completion->userid),
                            'timestamp' => $completion->timemodified,
                            'action' => 'completed',
                            'course_section' => $cm->sectionnum,
                            'activity_url' => $cm->url ? $cm->url->out(false) : null,
                            'icon_url' => $cm->get_icon_url()->out(false),
                        ];
                    }
                }
            }
        }
        
        return $activities;
    }
    
    /**
     * Get module-specific recent activity (forum posts, assignments, etc.).
     *
     * Calls each activity module's print_recent_activity() callback to get
     * module-specific recent activities. Parses the HTML output into structured data.
     *
     * @param object $course    Course object
     * @param int    $timestart Unix timestamp to fetch activity since
     * @return array Array of activity objects
     */
    private function getModuleRecentActivity($course, $timestart) {
        global $DB;
        
        $activities = [];
        
        $context = context_course::instance($course->id);
        $viewFullnames = has_capability('moodle/site:viewfullnames', $context);
        
        $modinfo = get_fast_modinfo($course);
        $usedModules = $modinfo->get_used_module_names();
        
        // Get recent activity from each module type
        foreach ($usedModules as $modname => $modfullname) {
            // Check for module's print_recent_activity callback
            $hasRecentActivity = component_callback(
                'mod_' . $modname,
                'print_recent_activity',
                [$course, $viewFullnames, $timestart],
                false
            );
            
            // Note: The callback returns HTML which is difficult to parse into structured data.
            // For now, we focus on structural changes, completions, and direct database queries.
            // A future enhancement could parse the HTML or create new module callbacks for JSON.
        }
        
        // Get recent forum posts directly
        if (in_array('forum', array_keys($usedModules))) {
            $forumPosts = $this->getRecentForumPosts($course->id, $timestart);
            $activities = array_merge($activities, $forumPosts);
        }
        
        // Get recent assignment submissions directly
        if (in_array('assign', array_keys($usedModules))) {
            $assignSubmissions = $this->getRecentAssignmentSubmissions($course->id, $timestart);
            $activities = array_merge($activities, $assignSubmissions);
        }
        
        return $activities;
    }
    
    /**
     * Get recent forum posts in course.
     *
     * Queries forum_posts and forum_discussions tables for recent posts.
     *
     * @param int $courseid  Course ID
     * @param int $timestart Unix timestamp to fetch posts since
     * @return array Array of activity objects
     */
    private function getRecentForumPosts($courseid, $timestart) {
        global $DB;
        
        $activities = [];
        
        $sql = "SELECT fp.id, fp.userid, fp.created, fp.subject,
                       fd.name as discussionname, f.name as forumname,
                       cm.id as cmid
                FROM {forum_posts} fp
                JOIN {forum_discussions} fd ON fd.id = fp.discussion
                JOIN {forum} f ON f.id = fd.forum
                JOIN {course_modules} cm ON cm.instance = f.id
                JOIN {modules} m ON m.id = cm.module AND m.name = 'forum'
                WHERE fp.created > :timestart
                  AND f.course = :courseid
                ORDER BY fp.created DESC
                LIMIT 20";
        
        $params = ['timestart' => $timestart, 'courseid' => $courseid];
        $posts = $DB->get_records_sql($sql, $params);
        
        if ($posts) {
            $modinfo = get_fast_modinfo($courseid);
            
            foreach ($posts as $post) {
                if (isset($modinfo->cms[$post->cmid])) {
                    $cm = $modinfo->cms[$post->cmid];
                    
                    if ($cm->uservisible) {
                        $activities[] = [
                            'activity_type' => 'post',
                            'activity_name' => $post->forumname,
                            'module_name' => 'forum',
                            'module_type' => 'forum',
                            'user_info' => $this->getUserInfo($post->userid),
                            'timestamp' => $post->created,
                            'action' => 'posted',
                            'course_section' => $cm->sectionnum,
                            'activity_url' => $cm->url ? $cm->url->out(false) : null,
                            'icon_url' => $cm->get_icon_url()->out(false),
                            'content_preview' => $this->truncateText($post->subject, 100),
                        ];
                    }
                }
            }
        }
        
        return $activities;
    }
    
    /**
     * Get recent assignment submissions in course.
     *
     * Queries assign_submission table for recent submissions.
     *
     * @param int $courseid  Course ID
     * @param int $timestart Unix timestamp to fetch submissions since
     * @return array Array of activity objects
     */
    private function getRecentAssignmentSubmissions($courseid, $timestart) {
        global $DB;
        
        $activities = [];
        
        $sql = "SELECT asub.id, asub.userid, asub.timemodified,
                       a.name as assignname, cm.id as cmid
                FROM {assign_submission} asub
                JOIN {assign} a ON a.id = asub.assignment
                JOIN {course_modules} cm ON cm.instance = a.id
                JOIN {modules} m ON m.id = cm.module AND m.name = 'assign'
                WHERE asub.timemodified > :timestart
                  AND a.course = :courseid
                  AND asub.status = 'submitted'
                ORDER BY asub.timemodified DESC
                LIMIT 20";
        
        $params = ['timestart' => $timestart, 'courseid' => $courseid];
        $submissions = $DB->get_records_sql($sql, $params);
        
        if ($submissions) {
            $modinfo = get_fast_modinfo($courseid);
            
            foreach ($submissions as $submission) {
                if (isset($modinfo->cms[$submission->cmid])) {
                    $cm = $modinfo->cms[$submission->cmid];
                    
                    if ($cm->uservisible) {
                        $activities[] = [
                            'activity_type' => 'submission',
                            'activity_name' => $submission->assignname,
                            'module_name' => 'assign',
                            'module_type' => 'assign',
                            'user_info' => $this->getUserInfo($submission->userid),
                            'timestamp' => $submission->timemodified,
                            'action' => 'submitted',
                            'course_section' => $cm->sectionnum,
                            'activity_url' => $cm->url ? $cm->url->out(false) : null,
                            'icon_url' => $cm->get_icon_url()->out(false),
                        ];
                    }
                }
            }
        }
        
        return $activities;
    }
    
    /**
     * Get recent grade changes in course.
     *
     * Queries grade_grades table for recently modified grades.
     *
     * @param int $courseid  Course ID
     * @param int $timestart Unix timestamp to fetch grade changes since
     * @return array Array of activity objects
     */
    private function getRecentGradeChanges($courseid, $timestart) {
        global $DB;
        
        $activities = [];
        
        $sql = "SELECT gg.id, gg.userid, gg.timemodified, gg.finalgrade,
                       gi.itemname, gi.itemtype, gi.itemmodule, gi.iteminstance
                FROM {grade_grades} gg
                JOIN {grade_items} gi ON gi.id = gg.itemid
                WHERE gg.timemodified > :timestart
                  AND gi.courseid = :courseid
                  AND gg.finalgrade IS NOT NULL
                ORDER BY gg.timemodified DESC
                LIMIT 20";
        
        $params = ['timestart' => $timestart, 'courseid' => $courseid];
        $grades = $DB->get_records_sql($sql, $params);
        
        if ($grades) {
            $modinfo = get_fast_modinfo($courseid);
            
            foreach ($grades as $grade) {
                $activityUrl = null;
                $iconUrl = null;
                $sectionNum = null;
                
                // Try to get activity info if this is a module grade
                if ($grade->itemtype === 'mod' && $grade->itemmodule && $grade->iteminstance) {
                    // Find the course module
                    if (isset($modinfo->instances[$grade->itemmodule][$grade->iteminstance])) {
                        $cm = $modinfo->instances[$grade->itemmodule][$grade->iteminstance];
                        if ($cm->uservisible) {
                            $activityUrl = $cm->url ? $cm->url->out(false) : null;
                            $iconUrl = $cm->get_icon_url()->out(false);
                            $sectionNum = $cm->sectionnum;
                        }
                    }
                }
                
                $activities[] = [
                    'activity_type' => 'grade',
                    'activity_name' => $grade->itemname ?: 'Grade item',
                    'module_name' => $grade->itemmodule ?: 'grade',
                    'module_type' => $grade->itemmodule ?: 'grade',
                    'user_info' => $this->getUserInfo($grade->userid),
                    'timestamp' => $grade->timemodified,
                    'action' => 'graded',
                    'course_section' => $sectionNum,
                    'activity_url' => $activityUrl,
                    'icon_url' => $iconUrl,
                ];
            }
        }
        
        return $activities;
    }
    
    /**
     * Get user information for activity actor.
     *
     * Fetches user's basic profile information including name and profile image.
     *
     * @param int $userid User ID
     * @return array User information array with id, fullname, profileimageurl
     */
    private function getUserInfo($userid) {
        global $DB, $PAGE;
        
        try {
            $user = $DB->get_record('user', ['id' => $userid], 'id, firstname, lastname, picture, imagealt, email');
            
            if (!$user) {
                return null;
            }
            
            // Get user picture URL
            $userpicture = new user_picture($user);
            $userpicture->size = 35; // Small size for activity feed
            $pictureUrl = $userpicture->get_url($PAGE)->out(false);
            
            return [
                'id' => $user->id,
                'fullname' => fullname($user),
                'profileimageurl' => $pictureUrl,
            ];
            
        } catch (Exception $e) {
            return null;
        }
    }
    
    /**
     * Group activities by type for easier frontend rendering.
     *
     * Groups activities into categories: completions, posts, submissions,
     * grades, resources, structural.
     *
     * @param array $activities Array of activity objects
     * @return array Associative array with activity types as keys
     */
    private function groupActivitiesByType($activities) {
        $grouped = [
            'completions' => [],
            'posts' => [],
            'submissions' => [],
            'grades' => [],
            'structural' => [],
            'other' => [],
        ];
        
        foreach ($activities as $activity) {
            $type = $activity['activity_type'];
            
            switch ($type) {
                case 'completion':
                    $grouped['completions'][] = $activity;
                    break;
                case 'post':
                    $grouped['posts'][] = $activity;
                    break;
                case 'submission':
                    $grouped['submissions'][] = $activity;
                    break;
                case 'grade':
                    $grouped['grades'][] = $activity;
                    break;
                case 'structural':
                    $grouped['structural'][] = $activity;
                    break;
                default:
                    $grouped['other'][] = $activity;
                    break;
            }
        }
        
        return $grouped;
    }
    
    /**
     * Truncate text to specified length with ellipsis.
     *
     * Helper method to create preview text from longer content.
     *
     * @param string $text   Text to truncate
     * @param int    $length Maximum length
     * @return string Truncated text
     */
    private function truncateText($text, $length) {
        if (strlen($text) <= $length) {
            return $text;
        }
        
        return substr($text, 0, $length - 3) . '...';
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new RecentActivityEndpoint();
    $endpoint->execute();
}
