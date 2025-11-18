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
 * REST API endpoint for timeline block data.
 *
 * Handles GET /api/v1/blocks/timeline to return timeline widget data for React dashboard
 * showing upcoming activities and deadlines. Wraps block_timeline\output\main class and
 * core_calendar\local\api::get_action_events_by_timesort() to fetch user's action events
 * (assignments, quizzes, activities with due dates).
 *
 * Accepts parameters:
 * - sort: 'sortbydates' or 'sortbycourses' (default from user preference)
 * - filter: 'next7days', 'next30days', 'next3months', 'all', 'overdue' (default from user preference)
 * - limit: Number of activities to return (default 20)
 * - offset: Pagination offset (default 0)
 *
 * Returns JSON array of event objects with id, name, course, due date, module type,
 * overdue status, and navigation URL. Supports grouping by course or chronological
 * sorting based on user preference. Includes summary statistics for overdue and
 * upcoming events.
 *
 * Uses existing timeline block and calendar event logic with zero business logic duplication.
 * Critical for dashboard TimelineWidget component providing deadline tracking and activity
 * planning for students.
 *
 * @package    api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and API base
require_once(__DIR__ . '/../../lib/api_base.php');

// Load Moodle core libraries
require_once($CFG->dirroot . '/blocks/timeline/lib.php');
require_once($CFG->dirroot . '/calendar/lib.php');
require_once($CFG->libdir . '/completionlib.php');

/**
 * Timeline block API endpoint class.
 *
 * Extends ApiBase to provide JWT authentication and HTTP routing for timeline
 * block data. Returns upcoming activities, deadlines, and action events for
 * the authenticated user with support for filtering and sorting.
 */
class TimelineEndpoint extends ApiBase {
    
    /**
     * Handle GET requests for timeline data.
     *
     * Retrieves timeline events (assignments, quizzes, activities with due dates)
     * for the authenticated user. Supports filtering by time period and sorting
     * by date or course. Uses existing block_timeline and calendar API functions
     * with zero business logic duplication.
     *
     * Query Parameters:
     * - sort: 'sortbydates' (BLOCK_TIMELINE_SORT_BY_DATES) or 'sortbycourses' (BLOCK_TIMELINE_SORT_BY_COURSES)
     * - filter: 'next7days', 'next30days', 'next3months', 'all', 'overdue'
     * - limit: Number of events to return (1-50, default 20)
     * - offset: Pagination offset for retrieving events after a specific event ID
     *
     * @return void Outputs JSON response via success() method
     * @throws UnauthorizedException If user is not authenticated
     * @throws ValidationException If parameters are invalid
     */
    protected function handle_get() {
        global $DB;
        
        // Get authenticated user
        $user = $this->getUser();
        
        // Permission check: User must be able to view their own profile
        // This ensures authenticated users can access their own timeline
        $usercontext = \context_user::instance($user->id);
        if (!has_capability('moodle/user:viewownprofile', $usercontext)) {
            $this->error('You do not have permission to view your timeline', 403);
        }
        
        // Get query parameters with defaults from user preferences
        $sort = $this->getParam('sort', PARAM_ALPHA, false, 
            get_user_preferences('block_timeline_user_sort_preference', BLOCK_TIMELINE_SORT_BY_DATES));
        
        $filter = $this->getParam('filter', PARAM_ALPHANUM, false,
            get_user_preferences('block_timeline_user_filter_preference', BLOCK_TIMELINE_FILTER_BY_30_DAYS));
        
        $limit = $this->getParam('limit', PARAM_INT, false,
            get_user_preferences('block_timeline_user_limit_preference', BLOCK_TIMELINE_ACTIVITIES_LIMIT_DEFAULT));
        
        $offset = $this->getParam('offset', PARAM_INT, false, 0);
        
        // Validate sort parameter
        $validSorts = [BLOCK_TIMELINE_SORT_BY_DATES, BLOCK_TIMELINE_SORT_BY_COURSES];
        if (!in_array($sort, $validSorts)) {
            $this->error(
                'INVALID_SORT',
                'Invalid sort parameter. Must be "sortbydates" or "sortbycourses"',
                400,
                ['provided' => $sort, 'valid' => $validSorts]
            );
            return;
        }
        
        // Validate filter parameter
        $validFilters = [
            BLOCK_TIMELINE_FILTER_BY_NONE,
            BLOCK_TIMELINE_FILTER_BY_OVERDUE,
            BLOCK_TIMELINE_FILTER_BY_7_DAYS,
            BLOCK_TIMELINE_FILTER_BY_30_DAYS,
            BLOCK_TIMELINE_FILTER_BY_3_MONTHS,
            BLOCK_TIMELINE_FILTER_BY_6_MONTHS
        ];
        if (!in_array($filter, $validFilters)) {
            $this->error(
                'INVALID_FILTER',
                'Invalid filter parameter. Must be one of: all, overdue, next7days, next30days, next3months, next6months',
                400,
                ['provided' => $filter, 'valid' => $validFilters]
            );
            return;
        }
        
        // Validate limit parameter (must be between 1 and 50)
        if ($limit < 1 || $limit > 50) {
            $this->error(
                'INVALID_LIMIT',
                'Limit must be between 1 and 50 (inclusive)',
                400,
                ['provided' => $limit, 'min' => 1, 'max' => 50]
            );
            return;
        }
        
        // Calculate time range based on filter
        $timesortfrom = null;
        $timesortto = null;
        $now = time();
        
        switch ($filter) {
            case BLOCK_TIMELINE_FILTER_BY_OVERDUE:
                // Overdue events: from 2 weeks ago to now
                $timesortfrom = $now - (14 * 86400);
                $timesortto = $now;
                break;
                
            case BLOCK_TIMELINE_FILTER_BY_7_DAYS:
                // Next 7 days
                $timesortfrom = $now;
                $timesortto = $now + (7 * 86400);
                break;
                
            case BLOCK_TIMELINE_FILTER_BY_30_DAYS:
                // Next 30 days
                $timesortfrom = $now;
                $timesortto = $now + (30 * 86400);
                break;
                
            case BLOCK_TIMELINE_FILTER_BY_3_MONTHS:
                // Next 3 months (90 days)
                $timesortfrom = $now;
                $timesortto = $now + (90 * 86400);
                break;
                
            case BLOCK_TIMELINE_FILTER_BY_6_MONTHS:
                // Next 6 months (180 days)
                $timesortfrom = $now;
                $timesortto = $now + (180 * 86400);
                break;
                
            case BLOCK_TIMELINE_FILTER_BY_NONE:
            default:
                // All events: from 2 weeks ago to far future
                $timesortfrom = $now - (14 * 86400);
                $timesortto = null; // No end limit
                break;
        }
        
        try {
            // Use calendar API to fetch action events by timesort
            // This wraps the existing core_calendar\local\api::get_action_events_by_timesort() function
            $aftereventid = $offset > 0 ? $offset : null;
            
            $events = \core_calendar\local\api::get_action_events_by_timesort(
                $timesortfrom,
                $timesortto,
                $aftereventid,
                $limit,
                false, // limittononsuspendedevents
                $user
            );
            
            // Transform events to API response format
            $transformedEvents = [];
            $overdueCount = 0;
            $upcomingCount = 0;
            
            foreach ($events as $event) {
                // Determine if event is overdue
                $isOverdue = false;
                if (isset($event->timesort) && $event->timesort < $now) {
                    $isOverdue = true;
                    $overdueCount++;
                } else {
                    $upcomingCount++;
                }
                
                // Get course information
                $courseName = '';
                $courseId = 0;
                if (isset($event->course) && $event->course->id) {
                    $courseId = $event->course->id;
                    $courseName = $event->course->fullname ?? '';
                }
                
                // Build event URL
                $url = '';
                if (isset($event->url)) {
                    $url = $event->url->out(false);
                }
                
                // Get module name and icon
                $moduleName = '';
                $icon = '';
                if (isset($event->icon)) {
                    $icon = $event->icon->get_pix_url();
                    if (isset($event->icon->component)) {
                        $moduleName = str_replace('mod_', '', $event->icon->component);
                    }
                }
                
                // Build transformed event object
                $transformedEvent = [
                    'id' => $event->id,
                    'name' => $event->name ?? '',
                    'description' => isset($event->description) ? format_text($event->description, FORMAT_HTML) : '',
                    'modulename' => $moduleName,
                    'instance' => $event->instance ?? 0,
                    'course_name' => $courseName,
                    'courseid' => $courseId,
                    'timestart' => $event->timestart ?? null,
                    'timesort' => $event->timesort ?? null,
                    'url' => $url,
                    'icon' => $icon,
                    'overdue' => $isOverdue,
                    'user_can_view' => true, // Already filtered by calendar API
                    'is_actionable' => isset($event->action),
                    'eventtype' => $event->eventtype ?? '',
                ];
                
                // Add event count for grouped events (used when sorting by courses)
                if (isset($event->eventcount)) {
                    $transformedEvent['event_count'] = $event->eventcount;
                }
                
                $transformedEvents[] = $transformedEvent;
            }
            
            // Group events by course if sort is 'sortbycourses'
            if ($sort === BLOCK_TIMELINE_SORT_BY_COURSES) {
                $groupedEvents = [];
                foreach ($transformedEvents as $event) {
                    $courseId = $event['courseid'];
                    if (!isset($groupedEvents[$courseId])) {
                        $groupedEvents[$courseId] = [
                            'course_id' => $courseId,
                            'course_name' => $event['course_name'],
                            'events' => []
                        ];
                    }
                    $groupedEvents[$courseId]['events'][] = $event;
                }
                
                // Convert to indexed array
                $transformedEvents = array_values($groupedEvents);
            }
            
            // Build summary statistics
            $summary = [
                'total' => count($events),
                'overdue' => $overdueCount,
                'upcoming' => $upcomingCount,
                'filter_applied' => $filter,
                'sort_applied' => $sort
            ];
            
            // Add time period summary based on filter
            switch ($filter) {
                case BLOCK_TIMELINE_FILTER_BY_7_DAYS:
                    $summary['time_period'] = 'Next 7 days';
                    break;
                case BLOCK_TIMELINE_FILTER_BY_30_DAYS:
                    $summary['time_period'] = 'Next 30 days';
                    break;
                case BLOCK_TIMELINE_FILTER_BY_3_MONTHS:
                    $summary['time_period'] = 'Next 3 months';
                    break;
                case BLOCK_TIMELINE_FILTER_BY_6_MONTHS:
                    $summary['time_period'] = 'Next 6 months';
                    break;
                case BLOCK_TIMELINE_FILTER_BY_OVERDUE:
                    $summary['time_period'] = 'Overdue';
                    break;
                case BLOCK_TIMELINE_FILTER_BY_NONE:
                default:
                    $summary['time_period'] = 'All';
                    break;
            }
            
            // Build response data
            $responseData = [
                'events' => $transformedEvents,
                'summary' => $summary,
                'filter_applied' => $filter,
                'sort_applied' => $sort
            ];
            
            // Add pagination metadata if we have the maximum limit of events
            $meta = null;
            if (count($events) >= $limit) {
                // Get the last event ID for pagination
                $lastEvent = end($events);
                $meta = [
                    'pagination' => [
                        'limit' => $limit,
                        'has_more' => true,
                        'next_offset' => $lastEvent->id ?? 0
                    ]
                ];
            } else {
                $meta = [
                    'pagination' => [
                        'limit' => $limit,
                        'has_more' => false,
                        'next_offset' => null
                    ]
                ];
            }
            
            // Return success response
            $this->success($responseData, 200, $meta);
            
        } catch (\moodle_exception $e) {
            // Handle Moodle exceptions from calendar API
            $this->error(
                'TIMELINE_ERROR',
                'Failed to retrieve timeline events: ' . $e->getMessage(),
                500,
                [
                    'errorcode' => $e->errorcode ?? 'unknown',
                    'debuginfo' => $e->debuginfo ?? ''
                ]
            );
            
        } catch (Exception $e) {
            // Handle unexpected exceptions
            $this->error(
                'INTERNAL_ERROR',
                'An unexpected error occurred while retrieving timeline events',
                500,
                [
                    'message' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine()
                ]
            );
        }
    }
    
    /**
     * Handle POST requests.
     *
     * Timeline endpoint does not support POST method. User preferences
     * for timeline sorting and filtering are updated via the user
     * preferences API, not this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for timeline endpoint', [
            'supportedMethods' => ['GET'],
            'reason' => 'Timeline is read-only. Use user preferences API to update sort/filter settings.'
        ]);
    }
    
    /**
     * Handle PUT requests.
     *
     * Timeline endpoint does not support PUT method. This is a read-only
     * endpoint for retrieving timeline data.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for timeline endpoint', [
            'supportedMethods' => ['GET'],
            'reason' => 'Timeline is read-only. Use user preferences API to update sort/filter settings.'
        ]);
    }
    
    /**
     * Handle DELETE requests.
     *
     * Timeline endpoint does not support DELETE method. This is a read-only
     * endpoint for retrieving timeline data.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for timeline endpoint', [
            'supportedMethods' => ['GET'],
            'reason' => 'Timeline is read-only. Use event-specific APIs to delete events.'
        ]);
    }
}

// Execute the endpoint
$endpoint = new TimelineEndpoint();
$endpoint->execute();
