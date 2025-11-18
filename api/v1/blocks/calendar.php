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
 * Calendar Block API Endpoint
 *
 * REST API endpoint for GET /api/v1/blocks/calendar providing monthly calendar
 * widget data for React dashboard components. Returns calendar month view with
 * events formatted for React CalendarWidget consumption.
 *
 * This endpoint wraps existing Moodle calendar functions (calendar_information::create
 * and calendar_get_view) without duplicating any business logic. All calendar
 * retrieval, event filtering, and permission checking remain in core Moodle.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once(__DIR__ . '/../../lib/api_base.php');
require_once($CFG->dirroot . '/calendar/lib.php');
require_once($CFG->dirroot . '/lib/moodlelib.php');

/**
 * Calendar Block API endpoint class.
 *
 * Handles GET requests to /api/v1/blocks/calendar providing monthly calendar
 * view data with events for authenticated users. Supports optional parameters
 * for month/year/course/category filtering.
 *
 * @package    core
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class calendar_block_api extends ApiBase {
    
    /**
     * Handle GET request for calendar widget data.
     *
     * Retrieves monthly calendar view with events for the authenticated user.
     * Supports optional parameters for customizing the calendar view context.
     *
     * Query Parameters:
     *   - month (int, optional): Month to display (1-12), defaults to current month
     *   - year (int, optional): Year to display (e.g., 2024), defaults to current year
     *   - courseid (int, optional): Course context for filtering events, defaults to site
     *   - categoryid (int, optional): Category context for filtering events, defaults to null
     *
     * Response Structure:
     *   {
     *     "success": true,
     *     "data": {
     *       "calendar": {
     *         "month_name": "January",
     *         "month": 1,
     *         "year": 2024,
     *         "weeks": [ ... ],
     *         "daynames": ["Sun", "Mon", "Tue", ...]
     *       },
     *       "events": [ ... ],
     *       "navigation": { ... },
     *       "has_events": true,
     *       "context": { ... }
     *     }
     *   }
     *
     * @return void Outputs JSON response directly
     * @throws moodle_exception If permission denied or invalid parameters
     */
    protected function handle_get() {
        global $CFG, $USER, $DB;
        
        // Ensure user is authenticated
        $user = $this->getUser();
        if (!$user) {
            return $this->error(
                'UNAUTHORIZED',
                'Authentication required to access calendar data',
                401
            );
        }
        
        // Get optional parameters with defaults
        $month = $this->getParam('month', PARAM_INT, false);
        $year = $this->getParam('year', PARAM_INT, false);
        $courseid = $this->getParam('courseid', PARAM_INT, false);
        $categoryid = $this->getParam('categoryid', PARAM_INT, false);
        
        // Validate and set defaults for month/year using current date
        $currenttime = time();
        if ($month === false || $year === false) {
            $currentdate = usergetdate($currenttime);
            if ($month === false) {
                $month = $currentdate['mon'];
            }
            if ($year === false) {
                $year = $currentdate['year'];
            }
        }
        
        // Validate month range
        if ($month < 1 || $month > 12) {
            return $this->error(
                'INVALID_MONTH',
                'Month parameter must be between 1 and 12',
                400,
                ['month' => $month]
            );
        }
        
        // Validate year range (reasonable bounds)
        if ($year < 1970 || $year > 2100) {
            return $this->error(
                'INVALID_YEAR',
                'Year parameter must be between 1970 and 2100',
                400,
                ['year' => $year]
            );
        }
        
        // Set courseid to SITEID if not provided or invalid
        if ($courseid === false || $courseid <= 0) {
            $courseid = SITEID;
        }
        
        // Validate course exists if provided
        if ($courseid !== SITEID) {
            if (!$DB->record_exists('course', ['id' => $courseid])) {
                return $this->error(
                    'COURSE_NOT_FOUND',
                    'The specified course does not exist',
                    404,
                    ['courseid' => $courseid]
                );
            }
        }
        
        // Set categoryid to null if not provided or invalid
        if ($categoryid === false || $categoryid <= 0) {
            $categoryid = null;
        }
        
        // Validate category exists if provided
        if ($categoryid !== null) {
            if (!$DB->record_exists('course_categories', ['id' => $categoryid])) {
                return $this->error(
                    'CATEGORY_NOT_FOUND',
                    'The specified category does not exist',
                    404,
                    ['categoryid' => $categoryid]
                );
            }
        }
        
        // Create timestamp for the first day of the requested month
        $type = \core_calendar\type_factory::get_calendar_instance();
        $timestamp = $type->convert_to_timestamp($year, $month, 1);
        
        // Create calendar information object using existing Moodle function
        // This handles all permission checks and context determination
        try {
            $calendar = calendar_information::create($timestamp, $courseid, $categoryid);
        } catch (Exception $e) {
            return $this->error(
                'CALENDAR_ERROR',
                'Failed to create calendar information: ' . $e->getMessage(),
                500,
                ['exception' => get_class($e)]
            );
        }
        
        // Check calendar view capability in the determined context
        // Uses Moodle's existing capability system
        try {
            $this->checkCapability('moodle/calendar:view', $calendar->context);
        } catch (Exception $e) {
            return $this->error(
                'PERMISSION_DENIED',
                'You do not have permission to view the calendar in this context',
                403,
                [
                    'context' => $calendar->context->id,
                    'required_capability' => 'moodle/calendar:view'
                ]
            );
        }
        
        // Get calendar view data using existing Moodle function
        // 'monthblock' view is specifically for calendar block display
        // This function returns both data and template (we only need data)
        try {
            list($calendardata, $template) = calendar_get_view($calendar, 'monthblock', false);
        } catch (Exception $e) {
            return $this->error(
                'CALENDAR_RENDER_ERROR',
                'Failed to retrieve calendar view: ' . $e->getMessage(),
                500,
                ['exception' => get_class($e)]
            );
        }
        
        // Transform calendar data to JSON-friendly structure for React
        $response = $this->transform_calendar_data($calendardata, $calendar, $month, $year);
        
        // Return successful response with calendar data
        return $this->success($response, 200);
    }
    
    /**
     * Transform calendar data from Moodle format to React-friendly JSON structure.
     *
     * Converts the calendar data array returned by calendar_get_view() into a
     * structure optimized for consumption by React CalendarWidget component.
     * Includes calendar grid, events list, navigation data, and metadata.
     *
     * @param array $calendardata Calendar data from calendar_get_view()
     * @param calendar_information $calendar Calendar information object
     * @param int $month Current month being displayed
     * @param int $year Current year being displayed
     * @return array Transformed data structure for JSON response
     */
    private function transform_calendar_data($calendardata, $calendar, $month, $year) {
        global $CFG;
        
        // Initialize response structure
        $response = [
            'calendar' => [
                'month' => $month,
                'year' => $year,
                'month_name' => userdate(mktime(0, 0, 0, $month, 1, $year), '%B'),
                'weeks' => [],
                'daynames' => []
            ],
            'events' => [],
            'navigation' => [
                'previous_month' => $month - 1,
                'previous_year' => $year,
                'next_month' => $month + 1,
                'next_year' => $year
            ],
            'has_events' => false,
            'context' => [
                'courseid' => $calendar->courseid,
                'categoryid' => $calendar->categoryid,
                'context_level' => $calendar->context->contextlevel
            ]
        ];
        
        // Adjust navigation for year boundaries
        if ($response['navigation']['previous_month'] < 1) {
            $response['navigation']['previous_month'] = 12;
            $response['navigation']['previous_year'] = $year - 1;
        }
        if ($response['navigation']['next_month'] > 12) {
            $response['navigation']['next_month'] = 1;
            $response['navigation']['next_year'] = $year + 1;
        }
        
        // Extract day names if available in calendar data
        if (isset($calendardata->daynames)) {
            $response['calendar']['daynames'] = $calendardata->daynames;
        } else {
            // Default day names if not provided
            $response['calendar']['daynames'] = [
                get_string('sunday', 'calendar'),
                get_string('monday', 'calendar'),
                get_string('tuesday', 'calendar'),
                get_string('wednesday', 'calendar'),
                get_string('thursday', 'calendar'),
                get_string('friday', 'calendar'),
                get_string('saturday', 'calendar')
            ];
        }
        
        // Transform weeks and days data
        if (isset($calendardata->weeks)) {
            foreach ($calendardata->weeks as $week) {
                $weekdata = [
                    'days' => []
                ];
                
                if (isset($week->days)) {
                    foreach ($week->days as $day) {
                        $daydata = [
                            'timestamp' => isset($day->timestamp) ? $day->timestamp : 0,
                            'day' => isset($day->mday) ? $day->mday : 0,
                            'istoday' => isset($day->istoday) ? (bool)$day->istoday : false,
                            'isweekend' => isset($day->isweekend) ? (bool)$day->isweekend : false,
                            'isinmonth' => isset($day->isinmonth) ? (bool)$day->isinmonth : true,
                            'event_count' => 0,
                            'events' => []
                        ];
                        
                        // Extract events for this day
                        if (isset($day->events) && is_array($day->events)) {
                            $daydata['event_count'] = count($day->events);
                            $response['has_events'] = true;
                            
                            foreach ($day->events as $event) {
                                $eventdata = $this->transform_event($event);
                                $daydata['events'][] = $eventdata;
                                
                                // Also add to main events list if not already present
                                $eventid = isset($event->id) ? $event->id : 0;
                                if ($eventid > 0) {
                                    $exists = false;
                                    foreach ($response['events'] as $existingevent) {
                                        if ($existingevent['id'] === $eventid) {
                                            $exists = true;
                                            break;
                                        }
                                    }
                                    if (!$exists) {
                                        $response['events'][] = $eventdata;
                                    }
                                }
                            }
                        }
                        
                        $weekdata['days'][] = $daydata;
                    }
                }
                
                $response['calendar']['weeks'][] = $weekdata;
            }
        }
        
        return $response;
    }
    
    /**
     * Transform a single calendar event to React-friendly format.
     *
     * Extracts relevant event properties and formats them for JSON consumption
     * by React components. Includes event metadata, timing, course context, and
     * display properties.
     *
     * @param stdClass $event Calendar event object from Moodle
     * @return array Transformed event data
     */
    private function transform_event($event) {
        global $CFG;
        
        $eventdata = [
            'id' => isset($event->id) ? (int)$event->id : 0,
            'name' => isset($event->name) ? $event->name : '',
            'description' => '',
            'event_type' => isset($event->eventtype) ? $event->eventtype : 'unknown',
            'time_start' => isset($event->timestart) ? (int)$event->timestart : 0,
            'time_duration' => isset($event->timeduration) ? (int)$event->timeduration : 0,
            'time_modified' => isset($event->timemodified) ? (int)$event->timemodified : 0,
            'course_id' => isset($event->courseid) ? (int)$event->courseid : 0,
            'course_name' => '',
            'module_name' => isset($event->modulename) ? $event->modulename : null,
            'instance_id' => isset($event->instance) ? (int)$event->instance : 0,
            'visible' => isset($event->visible) ? (bool)$event->visible : true,
            'url' => '',
            'icon' => []
        ];
        
        // Add description if available (may be in different properties)
        if (isset($event->description)) {
            $eventdata['description'] = $event->description;
        } else if (isset($event->shortdescription)) {
            $eventdata['description'] = $event->shortdescription;
        }
        
        // Add course name if available
        if (isset($event->course)) {
            if (is_object($event->course)) {
                $eventdata['course_name'] = isset($event->course->fullname) ? $event->course->fullname : '';
            } else if (is_string($event->course)) {
                $eventdata['course_name'] = $event->course;
            }
        }
        
        // Add URL if available
        if (isset($event->url)) {
            if (is_object($event->url)) {
                $eventdata['url'] = $event->url->out(false);
            } else if (is_string($event->url)) {
                $eventdata['url'] = $event->url;
            }
        }
        
        // Add icon information if available
        if (isset($event->icon)) {
            if (is_object($event->icon)) {
                $eventdata['icon'] = [
                    'key' => isset($event->icon->key) ? $event->icon->key : '',
                    'component' => isset($event->icon->component) ? $event->icon->component : '',
                    'alt' => isset($event->icon->alt) ? $event->icon->alt : '',
                    'url' => isset($event->icon->pix) ? $CFG->wwwroot . '/theme/image.php/' .
                        $event->icon->pix : ''
                ];
            }
        }
        
        // Add formatted time strings for display
        if ($eventdata['time_start'] > 0) {
            $eventdata['formatted_time'] = userdate($eventdata['time_start'], get_string('strftimedatetime', 'langconfig'));
            $eventdata['formatted_date'] = userdate($eventdata['time_start'], get_string('strftimedate', 'langconfig'));
            $eventdata['formatted_time_short'] = userdate($eventdata['time_start'], get_string('strftimetime', 'langconfig'));
        }
        
        return $eventdata;
    }
    
    /**
     * Handle POST request - not allowed for calendar endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not allowed for calendar endpoint');
    }
    
    /**
     * Handle PUT request - not allowed for calendar endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not allowed for calendar endpoint');
    }
    
    /**
     * Handle DELETE request - not allowed for calendar endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed for calendar endpoint');
    }
}

// Execute the API endpoint
$api = new calendar_block_api();
$api->execute();
