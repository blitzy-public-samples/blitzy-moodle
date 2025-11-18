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
 * Gradebook Export API Endpoint
 *
 * REST API endpoint for exporting gradebook data in JSON format including all selected
 * grade items, student grades, feedback, and grade display formats. Wraps grade_export
 * class functionality and grade_item::fetch_all() from public/grade/export/lib.php to
 * return structured gradebook data suitable for export to CSV, Excel, or other formats
 * by client. Enforces moodle/grade:export capability before exposing data.
 *
 * GET /api/v1/gradebook/export
 *
 * Required Parameters:
 * - courseid: The ID of the course (integer)
 *
 * Optional Parameters:
 * - groupid: Group ID to filter users (default: 0 for all groups)
 * - export_feedback: Include feedback text (default: false, values: true/false)
 * - export_letters: Include letter grades (default: false, values: true/false)
 * - displaytype: Grade display format (default: GRADE_DISPLAY_TYPE_REAL)
 *                Allowed values: GRADE_DISPLAY_TYPE_REAL, GRADE_DISPLAY_TYPE_PERCENTAGE,
 *                GRADE_DISPLAY_TYPE_LETTER, GRADE_DISPLAY_TYPE_LETTER_REAL,
 *                GRADE_DISPLAY_TYPE_LETTER_PERCENTAGE
 * - itemids: Comma-separated list of grade item IDs to include (default: all items)
 *
 * Required Capability: moodle/grade:export
 *
 * Response Format (JSON):
 * {
 *   "success": true,
 *   "data": {
 *     "course": {
 *       "id": 5,
 *       "fullname": "Course Name",
 *       "shortname": "COURSE101"
 *     },
 *     "columns": [
 *       {"key": "firstname", "name": "First Name"},
 *       {"key": "lastname", "name": "Last Name"},
 *       {"key": "email", "name": "Email"},
 *       {"key": "grade_10", "name": "Assignment 1"}
 *     ],
 *     "rows": [
 *       {
 *         "userid": 123,
 *         "firstname": "John",
 *         "lastname": "Doe",
 *         "email": "john@example.com",
 *         "grades": [
 *           {
 *             "itemid": 10,
 *             "itemname": "Assignment 1",
 *             "grade": "85.50",
 *             "feedback": "Good work",
 *             "feedbackformat": 1
 *           }
 *         ]
 *       }
 *     ],
 *     "export_metadata": {
 *       "timestamp": 1234567890,
 *       "displaytype": 1,
 *       "export_feedback": true,
 *       "export_letters": false,
 *       "groupid": 0,
 *       "total_users": 25,
 *       "total_items": 5
 *     }
 *   }
 * }
 *
 * @package    core_grade
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('AJAX_SCRIPT', true);
define('NO_MOODLE_COOKIES', true);

require_once(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/gradelib.php');
require_once($CFG->dirroot . '/grade/lib.php');
require_once($CFG->dirroot . '/grade/export/lib.php');
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');
require_once(__DIR__ . '/../../lib/api_response.php');

/**
 * Gradebook Export API Handler
 *
 * Extends ApiBase to provide gradebook export functionality through REST API.
 * Delegates to existing Moodle grade export functions and uses graded_users_iterator
 * for efficient data retrieval following Moodle's established patterns.
 *
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class GradebookExportEndpoint extends ApiBase {

    /**
     * Handle GET request to export gradebook data
     *
     * Implements thin wrapper pattern delegating to existing Moodle grade functions:
     * - Uses grade_item::fetch_all() to get grade items
     * - Uses graded_users_iterator for efficient user/grade iteration
     * - Uses grade_format_gradevalue() for proper grade display formatting
     * - Enforces moodle/grade:export capability via checkCapability()
     *
     * @return void
     * @throws ApiException If course not found or permission denied
     */
    protected function handle_get(): void {
        global $DB, $CFG;

        // Extract and validate required courseid parameter
        $courseid = $this->getParam('courseid', PARAM_INT, true);

        // Validate course exists using Moodle's database API
        $course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);
        if (!$course) {
            $this->error('Course not found', 404);
            return;
        }

        // Get course context for capability checking
        $context = context_course::instance($courseid);

        // Enforce moodle/grade:export capability - critical security check
        // This ensures only authorized users can export grade data
        // Uses inherited checkCapability() from ApiBase which calls require_capability()
        $this->checkCapability('moodle/grade:export', $context);

        // Extract optional parameters with sensible defaults
        $groupid = $this->getParam('groupid', PARAM_INT, false, 0);
        $export_feedback = $this->getParam('export_feedback', PARAM_BOOL, false, false);
        $export_letters = $this->getParam('export_letters', PARAM_BOOL, false, false);
        
        // Display type parameter - supports various Moodle grade display formats
        // Default to GRADE_DISPLAY_TYPE_REAL (numeric grade)
        $displaytype = $this->getParam('displaytype', PARAM_INT, false, GRADE_DISPLAY_TYPE_REAL);
        
        // Validate displaytype is within acceptable range
        // Moodle defines these constants in lib/grade/constants.php
        $valid_display_types = [
            GRADE_DISPLAY_TYPE_REAL,              // 1 - Numeric grade
            GRADE_DISPLAY_TYPE_PERCENTAGE,        // 2 - Percentage
            GRADE_DISPLAY_TYPE_LETTER,            // 3 - Letter grade
            GRADE_DISPLAY_TYPE_LETTER_REAL,       // 4 - Letter and numeric
            GRADE_DISPLAY_TYPE_LETTER_PERCENTAGE  // 5 - Letter and percentage
        ];
        if (!in_array($displaytype, $valid_display_types)) {
            $displaytype = GRADE_DISPLAY_TYPE_REAL;
        }

        // Parse optional itemids filter (comma-separated list of grade item IDs)
        $itemids = $this->getParam('itemids', PARAM_SEQUENCE, false, '');
        $item_filter = [];
        if (!empty($itemids)) {
            $item_filter = explode(',', $itemids);
            $item_filter = array_map('intval', $item_filter);
            $item_filter = array_filter($item_filter); // Remove zeros
        }

        // Fetch all grade items for this course using existing Moodle function
        // grade_item::fetch_all() returns an associative array of grade_item objects
        // indexed by item ID - this is the standard Moodle pattern for retrieving grade items
        $grade_items = grade_item::fetch_all(['courseid' => $courseid]);

        if (empty($grade_items)) {
            // Course has no grade items - return empty export with just user columns
            $this->success([
                'course' => [
                    'id' => (int)$course->id,
                    'fullname' => $course->fullname,
                    'shortname' => $course->shortname
                ],
                'columns' => [
                    ['key' => 'firstname', 'name' => get_string('firstname')],
                    ['key' => 'lastname', 'name' => get_string('lastname')],
                    ['key' => 'email', 'name' => get_string('email')]
                ],
                'rows' => [],
                'export_metadata' => [
                    'timestamp' => time(),
                    'displaytype' => $displaytype,
                    'export_feedback' => $export_feedback,
                    'export_letters' => $export_letters,
                    'groupid' => $groupid,
                    'total_users' => 0,
                    'total_items' => 0
                ]
            ]);
            return;
        }

        // Filter grade items by itemids if specified
        if (!empty($item_filter)) {
            $filtered_items = [];
            foreach ($grade_items as $item) {
                if (in_array($item->id, $item_filter)) {
                    $filtered_items[$item->id] = $item;
                }
            }
            $grade_items = $filtered_items;
        }

        // Build columns array for export header
        // Start with standard user identification columns
        $columns = [
            ['key' => 'firstname', 'name' => get_string('firstname')],
            ['key' => 'lastname', 'name' => get_string('lastname')],
            ['key' => 'email', 'name' => get_string('email')]
        ];

        // Add column for each grade item
        foreach ($grade_items as $item) {
            $columns[] = [
                'key' => 'grade_' . $item->id,
                'name' => $item->get_name()
            ];
            // Add feedback column if feedback export is requested
            if ($export_feedback) {
                $columns[] = [
                    'key' => 'feedback_' . $item->id,
                    'name' => $item->get_name() . ' (' . get_string('feedback') . ')'
                ];
            }
        }

        // Use graded_users_iterator for efficient iteration through users and their grades
        // This is the recommended Moodle pattern for grade export operations
        // The iterator uses optimized SQL queries and handles memory efficiently
        // even for large courses with many students and grade items
        $gui = new graded_users_iterator($course, $columns, $groupid);
        $gui->require_active_enrolment($courseid);
        $gui->init();

        $rows = [];
        $user_count = 0;

        // Iterate through each user with grades
        // The iterator returns user data along with associated grades
        while ($userdata = $gui->next_user()) {
            $user_count++;
            
            // Build row with user identification data
            $row = [
                'userid' => (int)$userdata->user->id,
                'firstname' => $userdata->user->firstname,
                'lastname' => $userdata->user->lastname,
                'email' => $userdata->user->email,
                'grades' => []
            ];

            // Process each grade item for this user
            foreach ($grade_items as $item) {
                $grade_data = [
                    'itemid' => (int)$item->id,
                    'itemname' => $item->get_name(),
                    'grade' => null,
                    'feedback' => null,
                    'feedbackformat' => null
                ];

                // Check if this user has a grade for this item
                // The graded_users_iterator provides grades indexed by item ID
                if (isset($userdata->grades[$item->id])) {
                    $grade = $userdata->grades[$item->id];
                    
                    // Format grade value using Moodle's grade_format_gradevalue function
                    // This handles percentage, letter grades, etc. based on displaytype
                    // Parameters:
                    // - $grade->finalgrade: The numeric grade value
                    // - $item: The grade_item object (contains grademin, grademax, etc.)
                    // - true: Return localized grade string
                    // - $displaytype: How to display (real, percentage, letter, etc.)
                    // - null: Use default decimal places from item settings
                    if (isset($grade->finalgrade) && $grade->finalgrade !== null) {
                        $grade_data['grade'] = grade_format_gradevalue(
                            $grade->finalgrade,
                            $item,
                            true,
                            $displaytype,
                            null
                        );
                    }

                    // Include feedback if requested and available
                    if ($export_feedback) {
                        if (!empty($grade->feedback)) {
                            $grade_data['feedback'] = $grade->feedback;
                            $grade_data['feedbackformat'] = isset($grade->feedbackformat) 
                                ? (int)$grade->feedbackformat 
                                : FORMAT_MOODLE;
                        }
                    }
                }

                $row['grades'][] = $grade_data;
            }

            $rows[] = $row;
        }

        // Clean up iterator resources
        // Important to close the database recordset to free memory
        $gui->close();

        // Build comprehensive response with course info, columns, data rows, and metadata
        $response = [
            'course' => [
                'id' => (int)$course->id,
                'fullname' => $course->fullname,
                'shortname' => $course->shortname
            ],
            'columns' => $columns,
            'rows' => $rows,
            'export_metadata' => [
                'timestamp' => time(),
                'displaytype' => $displaytype,
                'export_feedback' => $export_feedback,
                'export_letters' => $export_letters,
                'groupid' => $groupid,
                'total_users' => $user_count,
                'total_items' => count($grade_items)
            ]
        ];

        // Return successful JSON response using ApiBase::success()
        // This method formats the response according to ApiResponse standards
        $this->success($response);
    }

    /**
     * POST method not allowed for this endpoint
     *
     * @return void
     */
    protected function handle_post(): void {
        $this->error('Method not allowed', 405);
    }

    /**
     * PUT method not allowed for this endpoint
     *
     * @return void
     */
    protected function handle_put(): void {
        $this->error('Method not allowed', 405);
    }

    /**
     * DELETE method not allowed for this endpoint
     *
     * @return void
     */
    protected function handle_delete(): void {
        $this->error('Method not allowed', 405);
    }
}

// Instantiate and execute the endpoint
$endpoint = new GradebookExportEndpoint();
$endpoint->execute();
