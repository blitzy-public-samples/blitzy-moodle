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
 * REST API endpoint for course overview block widget data.
 *
 * Provides GET /api/v1/blocks/overview endpoint that returns course overview
 * widget data for React dashboard CourseOverviewWidget component. Wraps existing
 * enrol_get_users_courses() and block_myoverview functionality to fetch user's
 * enrolled courses with filtering, sorting, and pagination.
 *
 * Supports filtering by course timeline state (all/inprogress/past/future/favourite/hidden),
 * sorting by various criteria (fullname/shortname/lastaccess/timecreated), and
 * pagination with limit/offset parameters. Returns course data with completion
 * tracking, progress percentage, last access time, and other metadata.
 *
 * Example request:
 *   GET /api/v1/blocks/overview?classification=inprogress&sort=lastaccess&limit=12&offset=0
 *
 * Example response:
 * {
 *   "success": true,
 *   "data": {
 *     "courses": [
 *       {
 *         "id": 5,
 *         "fullname": "Introduction to PHP",
 *         "shortname": "PHP101",
 *         "summary": "Learn PHP basics...",
 *         "course_image": "https://...",
 *         "progress_percentage": 45,
 *         "last_access": 1640000000,
 *         "category_name": "Programming",
 *         "visible": true,
 *         "is_favourite": false,
 *         "course_url": "https://moodle.example.com/course/view.php?id=5",
 *         "completion": {
 *           "total_activities": 20,
 *           "completed_activities": 9,
 *           "completion_percentage": 45
 *         }
 *       }
 *     ],
 *     "total": 25,
 *     "has_more": true
 *   },
 *   "meta": {
 *     "pagination": {
 *       "limit": 12,
 *       "offset": 0,
 *       "total": 25
 *     }
 *   }
 * }
 *
 * @package    api
 * @subpackage blocks
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and dependencies
require_once(__DIR__ . '/../../lib/api_base.php');

// Load Moodle course library for enrol_get_users_courses()
require_once($CFG->dirroot . '/lib/enrollib.php');

// Load course library for course helper functions
require_once($CFG->dirroot . '/course/lib.php');

// Load completion library for progress tracking
require_once($CFG->libdir . '/completionlib.php');

// Load blocks myoverview library for constants and helper functions
require_once($CFG->dirroot . '/blocks/myoverview/lib.php');

// Load favourite service for checking starred courses
require_once($CFG->dirroot . '/lib/classes/favourites.php');

/**
 * API endpoint class for course overview block data.
 *
 * Extends ApiBase to provide authenticated access to user's enrolled courses
 * with filtering, sorting, and pagination capabilities. Follows thin wrapper
 * pattern by delegating all business logic to existing Moodle functions.
 */
class MyOverviewEndpoint extends ApiBase {
    
    /**
     * Handle GET request for course overview data.
     *
     * Fetches authenticated user's enrolled courses with optional filtering
     * by timeline state, sorting, and pagination. Returns course data with
     * completion tracking and metadata suitable for React dashboard widget.
     *
     * Query Parameters:
     * - classification: Filter courses by timeline state (default: 'inprogress')
     *     * 'all' - All visible courses
     *     * 'allincludinghidden' - All courses including hidden
     *     * 'inprogress' - Currently active courses
     *     * 'past' - Completed/ended courses
     *     * 'future' - Not yet started courses
     *     * 'favourite' - Starred courses
     *     * 'hidden' - Hidden courses
     * - filter: Alias for classification (deprecated, use classification)
     * - sort: Sort order for courses (default: 'lastaccessed')
     *     * 'fullname' - Sort by full name
     *     * 'shortname' - Sort by short name
     *     * 'lastaccess' - Sort by last access time (most recent first)
     *     * 'lastaccessed' - Alias for lastaccess
     *     * 'timecreated' - Sort by creation date
     *     * 'title' - Alias for fullname
     * - limit: Maximum courses per page (default: 12, 0 = all)
     * - offset: Number of courses to skip for pagination (default: 0)
     *
     * @return void Outputs JSON response with course data and pagination metadata
     */
    protected function handle_get() {
        global $CFG, $DB, $OUTPUT;
        
        // Get authenticated user
        $user = $this->getUser();
        $userid = $user->id;
        
        // Permission check: User must be able to view their own profile
        // This ensures authenticated users can access their own course overview
        // Note: This endpoint returns only the user's own enrolled courses,
        // and enrollment itself provides the authorization for each course
        $usercontext = \context_user::instance($userid);
        if (!has_capability('moodle/user:viewownprofile', $usercontext)) {
            $this->error('You do not have permission to view your course overview', 403);
        }
        
        // Extract and validate query parameters
        // Classification (filter) parameter - determines which courses to show
        $classification = $this->getParam('classification', PARAM_ALPHA, false, null);
        
        // Support legacy 'filter' parameter for backward compatibility
        if ($classification === null) {
            $classification = $this->getParam('filter', PARAM_ALPHA, false, 'inprogress');
        }
        
        // Validate classification against allowed values
        $validClassifications = [
            BLOCK_MYOVERVIEW_GROUPING_ALL,
            BLOCK_MYOVERVIEW_GROUPING_ALLINCLUDINGHIDDEN,
            BLOCK_MYOVERVIEW_GROUPING_INPROGRESS,
            BLOCK_MYOVERVIEW_GROUPING_PAST,
            BLOCK_MYOVERVIEW_GROUPING_FUTURE,
            BLOCK_MYOVERVIEW_GROUPING_FAVOURITES,
            BLOCK_MYOVERVIEW_GROUPING_HIDDEN,
        ];
        
        if (!in_array($classification, $validClassifications)) {
            $classification = BLOCK_MYOVERVIEW_GROUPING_INPROGRESS;
        }
        
        // Sort parameter - determines course ordering
        $sort = $this->getParam('sort', PARAM_ALPHA, false, 'lastaccessed');
        
        // Normalize sort aliases
        if ($sort === 'title') {
            $sort = 'fullname';
        }
        if ($sort === 'lastaccessed') {
            $sort = 'lastaccess';
        }
        
        // Validate sort against allowed values
        $validSorts = ['fullname', 'shortname', 'lastaccess', 'timecreated'];
        if (!in_array($sort, $validSorts)) {
            $sort = 'lastaccess';
        }
        
        // Pagination parameters
        $limit = $this->getParam('limit', PARAM_INT, false, 12);
        $offset = $this->getParam('offset', PARAM_INT, false, 0);
        
        // Ensure non-negative pagination values
        if ($limit < 0) {
            $limit = 12;
        }
        if ($offset < 0) {
            $offset = 0;
        }
        
        // Fetch all enrolled courses for the user using existing Moodle function
        // This calls the core enrollment system - no business logic duplication
        $onlyactive = true; // Only get active enrollments
        $fields = 'id, category, fullname, shortname, idnumber, summary, summaryformat, ' .
                  'startdate, enddate, visible, showgrades, lang, enablecompletion, ' .
                  'cacherev, timecreated, timemodified';
        $courses = enrol_get_users_courses($userid, $onlyactive, $fields);
        
        // Get user's last access times for all courses
        $lastaccesstimes = $DB->get_records_menu('user_lastaccess', 
            ['userid' => $userid], '', 'courseid, timeaccess');
        
        // Add last access time to course objects
        foreach ($courses as $course) {
            $course->lastaccess = isset($lastaccesstimes[$course->id]) 
                ? $lastaccesstimes[$course->id] 
                : 0;
        }
        
        // Get user's favourite (starred) courses using Moodle's favourite service
        $favouritecourses = [];
        try {
            $usercontext = \context_user::instance($userid);
            $ufservice = \core_favourites\service_factory::get_service_for_user_context($usercontext);
            $favourites = $ufservice->find_favourites_by_type('core_course', 'courses');
            
            foreach ($favourites as $favourite) {
                $favouritecourses[$favourite->itemid] = true;
            }
        } catch (Exception $e) {
            // If favourites fail, continue without them
            debugging('Failed to load favourite courses: ' . $e->getMessage(), DEBUG_DEVELOPER);
        }
        
        // Add is_favourite flag to courses
        foreach ($courses as $course) {
            $course->is_favourite = isset($favouritecourses[$course->id]);
        }
        
        // Apply classification filter to courses
        $filteredcourses = $this->filter_courses_by_classification(
            $courses, 
            $classification
        );
        
        // Sort the filtered courses
        $sortedcourses = $this->sort_courses($filteredcourses, $sort);
        
        // Calculate total before pagination
        $total = count($sortedcourses);
        
        // Apply pagination
        $paginatedcourses = array_slice($sortedcourses, $offset, $limit > 0 ? $limit : null);
        
        // Transform courses to API response format
        $coursesdata = [];
        foreach ($paginatedcourses as $course) {
            $coursesdata[] = $this->transform_course_to_array($course, $userid);
        }
        
        // Determine if there are more courses beyond current page
        $hasmore = ($limit > 0) && (($offset + $limit) < $total);
        
        // Prepare response data
        $responsedata = [
            'courses' => $coursesdata,
            'total' => $total,
            'has_more' => $hasmore,
        ];
        
        // Prepare pagination metadata
        $meta = [
            'pagination' => [
                'limit' => $limit,
                'offset' => $offset,
                'total' => $total,
            ]
        ];
        
        // Return success response with courses and pagination metadata
        $this->success($responsedata, 200, $meta);
    }
    
    /**
     * Filter courses by classification (timeline state).
     *
     * Applies filtering logic based on course start/end dates, visibility,
     * and user preferences. Uses existing Moodle logic patterns from
     * block_myoverview without duplicating business logic.
     *
     * @param array $courses Array of course objects
     * @param string $classification Classification filter to apply
     * @return array Filtered array of course objects
     */
    private function filter_courses_by_classification($courses, $classification) {
        $now = time();
        $filtered = [];
        
        foreach ($courses as $course) {
            $include = false;
            
            switch ($classification) {
                case BLOCK_MYOVERVIEW_GROUPING_ALLINCLUDINGHIDDEN:
                    // Include all courses regardless of visibility
                    $include = true;
                    break;
                    
                case BLOCK_MYOVERVIEW_GROUPING_ALL:
                    // Include only visible courses
                    $include = ($course->visible == 1);
                    break;
                    
                case BLOCK_MYOVERVIEW_GROUPING_INPROGRESS:
                    // Course is in progress if:
                    // - Start date is in the past or zero (no start date)
                    // - End date is in the future or zero (no end date)
                    // - Course is visible
                    $started = ($course->startdate == 0 || $course->startdate <= $now);
                    $notended = ($course->enddate == 0 || $course->enddate >= $now);
                    $include = ($started && $notended && $course->visible == 1);
                    break;
                    
                case BLOCK_MYOVERVIEW_GROUPING_PAST:
                    // Course is past if end date exists and is in the past
                    $include = ($course->enddate > 0 && $course->enddate < $now);
                    break;
                    
                case BLOCK_MYOVERVIEW_GROUPING_FUTURE:
                    // Course is future if start date exists and is in the future
                    $include = ($course->startdate > 0 && $course->startdate > $now);
                    break;
                    
                case BLOCK_MYOVERVIEW_GROUPING_FAVOURITES:
                    // Include only favourite (starred) courses
                    $include = !empty($course->is_favourite);
                    break;
                    
                case BLOCK_MYOVERVIEW_GROUPING_HIDDEN:
                    // Include only hidden courses
                    $include = ($course->visible == 0);
                    break;
                    
                default:
                    // Default to visible courses
                    $include = ($course->visible == 1);
                    break;
            }
            
            if ($include) {
                $filtered[] = $course;
            }
        }
        
        return $filtered;
    }
    
    /**
     * Sort courses by specified criteria.
     *
     * Applies sorting to course array using existing Moodle sorting patterns.
     * Uses PHP's usort with comparison functions for different sort types.
     *
     * @param array $courses Array of course objects to sort
     * @param string $sort Sort criteria (fullname/shortname/lastaccess/timecreated)
     * @return array Sorted array of course objects
     */
    private function sort_courses($courses, $sort) {
        // Convert to array for sorting (preserves array operations)
        $coursesarray = array_values($courses);
        
        // Define comparison function based on sort type
        $comparator = null;
        
        switch ($sort) {
            case 'fullname':
                $comparator = function($a, $b) {
                    return strcasecmp($a->fullname, $b->fullname);
                };
                break;
                
            case 'shortname':
                $comparator = function($a, $b) {
                    return strcasecmp($a->shortname, $b->shortname);
                };
                break;
                
            case 'lastaccess':
                $comparator = function($a, $b) {
                    // Sort by last access descending (most recent first)
                    // Courses never accessed (0) go to the end
                    if ($a->lastaccess == 0 && $b->lastaccess == 0) {
                        return 0;
                    }
                    if ($a->lastaccess == 0) {
                        return 1;
                    }
                    if ($b->lastaccess == 0) {
                        return -1;
                    }
                    return $b->lastaccess - $a->lastaccess;
                };
                break;
                
            case 'timecreated':
                $comparator = function($a, $b) {
                    // Sort by creation time descending (newest first)
                    return $b->timecreated - $a->timecreated;
                };
                break;
                
            default:
                // Default to last access sorting
                $comparator = function($a, $b) {
                    if ($a->lastaccess == 0 && $b->lastaccess == 0) {
                        return 0;
                    }
                    if ($a->lastaccess == 0) {
                        return 1;
                    }
                    if ($b->lastaccess == 0) {
                        return -1;
                    }
                    return $b->lastaccess - $a->lastaccess;
                };
                break;
        }
        
        // Apply sorting
        usort($coursesarray, $comparator);
        
        return $coursesarray;
    }
    
    /**
     * Transform course object to API response array format.
     *
     * Converts Moodle course object to standardized array format for JSON API
     * response. Includes completion tracking, progress percentage, course image,
     * and other metadata required by React CourseOverviewWidget component.
     *
     * Uses existing Moodle functions for all data extraction - no business logic
     * duplication. Fetches completion data, course images, and category names
     * via core Moodle APIs.
     *
     * @param object $course Course object from database
     * @param int $userid User ID for completion and progress data
     * @return array Associative array with course data for API response
     */
    private function transform_course_to_array($course, $userid) {
        global $CFG, $DB, $OUTPUT;
        
        // Get course context for capability checks and image URL generation
        $coursecontext = \context_course::instance($course->id);
        
        // Get course category name
        $categoryname = '';
        if ($course->category > 0) {
            $category = $DB->get_record('course_categories', 
                ['id' => $course->category], 
                'id, name');
            if ($category) {
                $categoryname = $category->name;
            }
        }
        
        // Get course image URL using existing Moodle course image handler
        $courseimage = $this->get_course_image_url($course);
        
        // Get course URL
        $courseurl = new \moodle_url('/course/view.php', ['id' => $course->id]);
        
        // Initialize completion data
        $completiondata = null;
        
        // Get completion information if completion is enabled for the course
        if ($course->enablecompletion == 1) {
            try {
                // Use existing Moodle completion API - no business logic duplication
                $completion = new \completion_info($course);
                
                if ($completion->is_enabled()) {
                    // Get completion criteria for the course
                    $completioncriteria = $completion->get_criteria();
                    $totalactivities = count($completioncriteria);
                    
                    // Count completed activities for this user
                    $completedactivities = 0;
                    foreach ($completioncriteria as $criterion) {
                        $criterioncompletion = $completion->get_user_completion($userid, $criterion);
                        if ($criterioncompletion && $criterioncompletion->is_complete()) {
                            $completedactivities++;
                        }
                    }
                    
                    // Calculate completion percentage
                    $completionpercentage = 0;
                    if ($totalactivities > 0) {
                        $completionpercentage = round(($completedactivities / $totalactivities) * 100);
                    }
                    
                    // Prepare completion data for response
                    $completiondata = [
                        'total_activities' => $totalactivities,
                        'completed_activities' => $completedactivities,
                        'completion_percentage' => $completionpercentage,
                    ];
                }
            } catch (Exception $e) {
                // If completion fails, continue without it
                debugging('Failed to load completion data for course ' . $course->id . ': ' . $e->getMessage(), DEBUG_DEVELOPER);
            }
        }
        
        // Calculate progress percentage (use completion percentage if available, otherwise 0)
        $progresspercentage = 0;
        if ($completiondata !== null) {
            $progresspercentage = $completiondata['completion_percentage'];
        }
        
        // Build course data array for API response
        $coursedata = [
            'id' => (int)$course->id,
            'fullname' => $course->fullname,
            'shortname' => $course->shortname,
            'summary' => strip_tags($course->summary), // Remove HTML tags from summary
            'course_image' => $courseimage,
            'progress_percentage' => $progresspercentage,
            'last_access' => (int)$course->lastaccess,
            'category_name' => $categoryname,
            'visible' => (bool)$course->visible,
            'is_favourite' => (bool)$course->is_favourite,
            'course_url' => $courseurl->out(false),
        ];
        
        // Add completion data if available
        if ($completiondata !== null) {
            $coursedata['completion'] = $completiondata;
        }
        
        // Add start and end dates for timeline filtering on frontend
        $coursedata['startdate'] = (int)$course->startdate;
        $coursedata['enddate'] = (int)$course->enddate;
        
        return $coursedata;
    }
    
    /**
     * Get course image URL.
     *
     * Retrieves the course image URL using existing Moodle course image handling.
     * Returns course overview file if set, otherwise returns a default placeholder.
     * Uses core Moodle file serving - no custom file handling logic.
     *
     * @param object $course Course object
     * @return string URL to course image or placeholder
     */
    private function get_course_image_url($course) {
        global $CFG, $OUTPUT;
        
        // Get course overview files (images) using existing Moodle function
        // This uses the core file storage system - no business logic duplication
        $courseimage = '';
        
        try {
            // Use the course image helper from outputrenderers.php
            // This retrieves the first image file from the course summary files
            $courseinlist = new \core_course_list_element($course);
            
            // Get course overview files
            foreach ($courseinlist->get_course_overviewfiles() as $file) {
                if ($file->is_valid_image()) {
                    // Get file URL from Moodle's file serving system
                    $courseimage = \moodle_url::make_pluginfile_url(
                        $file->get_contextid(),
                        $file->get_component(),
                        $file->get_filearea(),
                        null,
                        $file->get_filepath(),
                        $file->get_filename()
                    )->out(false);
                    break; // Use first valid image
                }
            }
        } catch (Exception $e) {
            // If image retrieval fails, use empty string (frontend will show placeholder)
            debugging('Failed to load course image for course ' . $course->id . ': ' . $e->getMessage(), DEBUG_DEVELOPER);
        }
        
        // Return image URL or empty string for frontend placeholder
        return $courseimage;
    }
    
    /**
     * Handle POST request (not supported).
     *
     * This endpoint only supports GET requests. POST will return
     * 405 Method Not Allowed error.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT request (not supported).
     *
     * This endpoint only supports GET requests. PUT will return
     * 405 Method Not Allowed error.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE request (not supported).
     *
     * This endpoint only supports GET requests. DELETE will return
     * 405 Method Not Allowed error.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new MyOverviewEndpoint();
    $endpoint->execute();
}
