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
 * REST API endpoint for upcoming events widget data.
 *
 * Handles GET /api/v1/blocks/upcoming to return upcoming calendar events
 * and deadlines for React dashboard UpcomingEventsWidget component. Wraps
 * existing Moodle calendar functions including calendar_information and
 * core_calendar_external::get_calendar_action_events_by_timesort() with
 * zero business logic duplication.
 *
 * Accepts optional query parameters:
 * - lookahead: Number of days to look ahead (default: 21 days from config)
 * - maxevents: Maximum number of events to return (default: 10 from config)
 * - courseid: Filter events by specific course ID (optional)
 * - categoryid: Filter events by course category ID (optional)
 *
 * Returns JSON response with:
 * - events: Array of event objects with id, name, type, time details, URLs
 * - grouped: Events organized by relative date (today, tomorrow, this week, later)
 * - summary: Metadata including total count, overdue status, time range
 *
 * @package    api
 * @subpackage v1
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class
require_once(__DIR__ . '/../../lib/api_base.php');

// Load Moodle calendar libraries
require_once($CFG->dirroot . '/calendar/lib.php');
require_once($CFG->dirroot . '/calendar/externallib.php');

use core_calendar\local\api as calendar_api;

/**
 * Upcoming events block API endpoint.
 *
 * Extends ApiBase to provide upcoming calendar events data for dashboard
 * widgets. Fetches events within configurable lookahead period and formats
 * them for optimal display in React frontend with date grouping and
 * human-readable time labels.
 */
class UpcomingEventsEndpoint extends ApiBase {
    
    /**
     * Handle GET request for upcoming events.
     *
     * Retrieves upcoming calendar events within the specified lookahead period,
     * including both action events (activity deadlines) and calendar events
     * (meetings, reminders). Filters, sorts, and groups events by relative
     * date for organized display in dashboard widget.
     *
     * Query Parameters:
     * @param int    $lookahead   Number of days to look ahead (default from config or 21)
     * @param int    $maxevents   Maximum events to return (default from config or 10)
     * @param int    $courseid    Optional course ID filter
     * @param int    $categoryid  Optional category ID filter
     *
     * @return void Outputs JSON response with events array, grouped events, and summary
     * @throws UnauthorizedException If user is not authenticated
     * @throws ValidationException If parameters are invalid
     */
    protected function handle_get() {
        global $CFG, $PAGE;
        
        // Get authenticated user
        $user = $this->getUser();
        
        // Extract and validate query parameters
        $lookahead = $this->getParam('lookahead', PARAM_INT, false, 
            $CFG->block_calendar_upcoming_lookahead ?? CALENDAR_DEFAULT_UPCOMING_LOOKAHEAD);
        
        $maxevents = $this->getParam('maxevents', PARAM_INT, false, 
            $CFG->block_calendar_upcoming_maxevents ?? CALENDAR_DEFAULT_UPCOMING_MAXEVENTS);
        
        $courseid = $this->getParam('courseid', PARAM_INT, false, SITEID);
        $categoryid = $this->getParam('categoryid', PARAM_INT, false, null);
        
        // Validate lookahead days (must be between 1 and 365)
        if ($lookahead < 1 || $lookahead > 365) {
            $this->error(
                'INVALID_LOOKAHEAD',
                'Lookahead days must be between 1 and 365',
                400,
                ['lookahead' => $lookahead, 'min' => 1, 'max' => 365]
            );
            return;
        }
        
        // Validate maxevents (must be between 1 and 100)
        if ($maxevents < 1 || $maxevents > 100) {
            $this->error(
                'INVALID_MAXEVENTS',
                'Maximum events must be between 1 and 100',
                400,
                ['maxevents' => $maxevents, 'min' => 1, 'max' => 100]
            );
            return;
        }
        
        // Calculate time range: start from now, end at lookahead days in future
        $timestart = time();
        $timeend = $timestart + ($lookahead * 86400); // 86400 seconds = 1 day
        
        // Validate course access if courseid provided
        if ($courseid !== SITEID) {
            try {
                $course = get_course($courseid);
                $context = context_course::instance($courseid);
                $this->checkCapability('moodle/course:view', $context);
            } catch (Exception $e) {
                $this->error(
                    'COURSE_ACCESS_DENIED',
                    'Cannot access specified course',
                    403,
                    ['courseid' => $courseid, 'reason' => $e->getMessage()]
                );
                return;
            }
        }
        
        // Validate category access if categoryid provided
        if ($categoryid !== null) {
            try {
                $category = core_course_category::get($categoryid);
                $context = context_coursecat::instance($categoryid);
                $this->checkCapability('moodle/category:viewcourselist', $context);
            } catch (Exception $e) {
                $this->error(
                    'CATEGORY_ACCESS_DENIED',
                    'Cannot access specified category',
                    403,
                    ['categoryid' => $categoryid, 'reason' => $e->getMessage()]
                );
                return;
            }
        }
        
        try {
            // Use existing Moodle calendar API to fetch action events by timesort
            // This wraps calendar_api::get_action_events_by_timesort() with proper permissions
            $events = core_calendar_external::get_calendar_action_events_by_timesort(
                $timestart,           // Events after this time
                $timeend,             // Events before this time
                0,                    // After event ID (for pagination, 0 = from start)
                $maxevents,           // Limit number of events
                true,                 // Limit to non-suspended courses
                $user->id,            // User ID
                null                  // No search value
            );
            
            // Extract events array from exporter result
            $eventdata = $events['events'] ?? [];
            
        } catch (Exception $e) {
            $this->error(
                'CALENDAR_FETCH_ERROR',
                'Failed to retrieve calendar events',
                500,
                ['reason' => $e->getMessage()]
            );
            return;
        }
        
        // Transform events to frontend format with additional metadata
        $transformedEvents = [];
        $hasOverdue = false;
        $now = time();
        
        foreach ($eventdata as $event) {
            // Calculate relative time information
            $eventTime = $event['timesort'] ?? $event['timestart'] ?? 0;
            $daysUntil = floor(($eventTime - $now) / 86400);
            $isToday = date('Y-m-d', $eventTime) === date('Y-m-d', $now);
            $isOverdue = $eventTime < $now;
            
            if ($isOverdue) {
                $hasOverdue = true;
            }
            
            // Format human-readable time label
            $formattedTime = $this->formatEventTime($eventTime, $now);
            
            // Get course name if available
            $courseName = '';
            if (isset($event['course']) && isset($event['course']['fullname'])) {
                $courseName = $event['course']['fullname'];
            }
            
            // Transform event to standardized format for React frontend
            $transformedEvent = [
                'id' => $event['id'],
                'name' => $event['name'] ?? '',
                'description' => $event['description'] ?? '',
                'event_type' => $this->mapEventType($event),
                'modulename' => $event['modulename'] ?? null,
                'instance' => $event['instance'] ?? null,
                'course_name' => $courseName,
                'courseid' => $event['course']['id'] ?? null,
                'timestart' => $event['timestart'] ?? $eventTime,
                'timeend' => $event['timeduration'] ? ($event['timestart'] + $event['timeduration']) : null,
                'duration' => $event['timeduration'] ?? 0,
                'location' => $event['location'] ?? '',
                'url' => $event['url'] ?? '',
                'icon' => $event['icon'] ?? null,
                'formatted_time' => $formattedTime,
                'days_until' => (int)$daysUntil,
                'is_today' => $isToday,
                'is_overdue' => $isOverdue,
                'can_edit' => $event['canedit'] ?? false,
                'can_delete' => $event['candelete'] ?? false,
            ];
            
            $transformedEvents[] = $transformedEvent;
        }
        
        // Group events by relative date for organized display
        $grouped = $this->groupEventsByDate($transformedEvents, $now);
        
        // Calculate summary metadata
        $summary = [
            'total' => count($transformedEvents),
            'has_overdue' => $hasOverdue,
            'time_range' => [
                'start' => $timestart,
                'end' => $timeend,
            ],
        ];
        
        // Return success response with events, grouped data, and summary
        $this->success([
            'events' => $transformedEvents,
            'grouped' => $grouped,
            'summary' => $summary,
            'lookahead' => $lookahead,
        ]);
    }
    
    /**
     * Format event time as human-readable relative label.
     *
     * Converts Unix timestamp to human-friendly formats like:
     * - "Today at 3:00 PM"
     * - "Tomorrow at 10:00 AM"
     * - "Monday at 2:30 PM"
     * - "Jan 15 at 9:00 AM"
     *
     * @param int $eventTime Event Unix timestamp
     * @param int $now       Current Unix timestamp
     * @return string Human-readable time label
     */
    private function formatEventTime($eventTime, $now) {
        $eventDate = date('Y-m-d', $eventTime);
        $todayDate = date('Y-m-d', $now);
        $tomorrowDate = date('Y-m-d', $now + 86400);
        
        // Format time part (e.g., "3:00 PM")
        $timePart = date('g:i A', $eventTime);
        
        // Determine date part based on relative position
        if ($eventDate === $todayDate) {
            return "Today at {$timePart}";
        } elseif ($eventDate === $tomorrowDate) {
            return "Tomorrow at {$timePart}";
        } elseif ($eventTime < $now + (7 * 86400)) {
            // Within next week, show day name
            $dayName = date('l', $eventTime);
            return "{$dayName} at {$timePart}";
        } else {
            // Further out, show month and day
            $monthDay = date('M j', $eventTime);
            return "{$monthDay} at {$timePart}";
        }
    }
    
    /**
     * Map Moodle event type to standardized string identifier.
     *
     * Converts Moodle's event type identifiers to consistent string values
     * for frontend display: 'user', 'course', 'category', 'site', 'action'.
     *
     * @param array $event Event data array from calendar API
     * @return string Event type identifier
     */
    private function mapEventType($event) {
        // Check if this is an action event (activity deadline)
        if (isset($event['action']) || isset($event['modulename'])) {
            return 'action';
        }
        
        // Map based on event type if available
        if (isset($event['eventtype'])) {
            $eventType = $event['eventtype'];
            if (strpos($eventType, 'user') !== false) {
                return 'user';
            } elseif (strpos($eventType, 'course') !== false) {
                return 'course';
            } elseif (strpos($eventType, 'category') !== false) {
                return 'category';
            } elseif (strpos($eventType, 'site') !== false) {
                return 'site';
            }
        }
        
        // Default to course event
        return 'course';
    }
    
    /**
     * Group events by relative date categories.
     *
     * Organizes events into time-based buckets for easier frontend display:
     * - today: Events happening today
     * - tomorrow: Events happening tomorrow
     * - this_week: Events within next 7 days
     * - later: Events beyond 7 days
     *
     * @param array $events Array of transformed event objects
     * @param int   $now    Current Unix timestamp
     * @return array Associative array with date group keys and event arrays
     */
    private function groupEventsByDate($events, $now) {
        $grouped = [
            'today' => [],
            'tomorrow' => [],
            'this_week' => [],
            'later' => [],
        ];
        
        $todayDate = date('Y-m-d', $now);
        $tomorrowDate = date('Y-m-d', $now + 86400);
        $weekEnd = $now + (7 * 86400);
        
        foreach ($events as $event) {
            $eventTime = $event['timestart'];
            $eventDate = date('Y-m-d', $eventTime);
            
            // Skip overdue events (they don't fit in upcoming categories)
            if ($event['is_overdue']) {
                continue;
            }
            
            // Categorize by relative date
            if ($eventDate === $todayDate) {
                $grouped['today'][] = $event;
            } elseif ($eventDate === $tomorrowDate) {
                $grouped['tomorrow'][] = $event;
            } elseif ($eventTime <= $weekEnd) {
                $grouped['this_week'][] = $event;
            } else {
                $grouped['later'][] = $event;
            }
        }
        
        return $grouped;
    }
}

// Instantiate and execute the endpoint
$endpoint = new UpcomingEventsEndpoint();
$endpoint->execute();
