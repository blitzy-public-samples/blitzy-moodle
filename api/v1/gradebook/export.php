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
 * GET /api/v1/gradebook/export - Export gradebook data for a course
 *
 * This endpoint provides access to export gradebook data in various formats.
 * It returns the export data as JSON which can be further processed by the client
 * or downloaded as a file.
 *
 * Required Parameters:
 * - courseid: The ID of the course
 *
 * Optional Parameters:
 * - format: Export format (json, csv) - default: json
 * - userids: Comma-separated list of user IDs to export (default: all enrolled users)
 * - itemids: Comma-separated list of grade item IDs to export (default: all items)
 * - includehidden: Include hidden items (default: false)
 * - includefeedback: Include feedback text (default: false)
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
 *     "format": "json",
 *     "export_time": 1234567890,
 *     "columns": [
 *       {"key": "firstname", "label": "First Name"},
 *       {"key": "lastname", "label": "Last Name"},
 *       {"key": "email", "label": "Email"},
 *       {"key": "item_10", "label": "Assignment 1"}
 *     ],
 *     "rows": [
 *       {
 *         "firstname": "John",
 *         "lastname": "Doe",
 *         "email": "john@example.com",
 *         "item_10": "85.50",
 *         "item_10_feedback": "Good work"
 *       }
 *     ],
 *     "csv": "First Name,Last Name,Email,Assignment 1\nJohn,Doe,john@example.com,85.50"
 *   }
 * }
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('AJAX_SCRIPT', true);
define('NO_MOODLE_COOKIES', true);

require_once(__DIR__ . '/../../../public/config.php');
require_once($CFG->libdir . '/gradelib.php');
require_once($CFG->dirroot . '/grade/lib.php');
require_once($CFG->dirroot . '/grade/querylib.php');
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');
require_once(__DIR__ . '/../../lib/api_response.php');

/**
 * Gradebook Export Endpoint Class
 *
 * Handles GET requests to export gradebook data in various formats.
 *
 * @package    core
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class GradebookExportEndpoint extends ApiBase {
    
    /**
     * Convert array data to CSV format
     *
     * @param array $columns Column definitions
     * @param array $rows Data rows
     * @return string CSV formatted string
     */
    private function array_to_csv($columns, $rows) {
        $csv = [];
        
        // Header row
        $headers = [];
        foreach ($columns as $column) {
            $headers[] = $column['label'];
        }
        $csv[] = implode(',', array_map(function($value) {
            return '"' . str_replace('"', '""', $value) . '"';
        }, $headers));
        
        // Data rows
        foreach ($rows as $row) {
            $values = [];
            foreach ($columns as $column) {
                $key = $column['key'];
                $value = isset($row[$key]) ? $row[$key] : '';
                $values[] = '"' . str_replace('"', '""', $value) . '"';
            }
            $csv[] = implode(',', $values);
        }
        
        return implode("\n", $csv);
    }
    
    /**
     * Handle GET request to export gradebook
     *
     * Validates permissions, retrieves grade data for specified users and items,
     * and returns formatted export data in the requested format.
     *
     * @return void Outputs JSON response
     * @throws ApiException If validation fails or course not found
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Extract and validate parameters
        $courseid = required_param('courseid', PARAM_INT);
        $format = optional_param('format', 'json', PARAM_ALPHA);
        $useridsparam = optional_param('userids', '', PARAM_SEQUENCE);
        $itemidsparam = optional_param('itemids', '', PARAM_SEQUENCE);
        $includehidden = optional_param('includehidden', false, PARAM_BOOL);
        $includefeedback = optional_param('includefeedback', false, PARAM_BOOL);
        
        // Validate format
        $allowedformats = ['json', 'csv'];
        if (!in_array($format, $allowedformats)) {
            throw new ApiException('Invalid format. Allowed formats: ' . implode(', ', $allowedformats), 'INVALID_FORMAT', 400);
        }
        
        // Verify course exists
        $course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);
        if (!$course) {
            throw new ApiException('Course not found', 'COURSE_NOT_FOUND', 404);
        }
        
        // Get course context
        $context = context_course::instance($course->id);
        
        // Validate JWT token and get authenticated user
        $userid = $this->authenticate_request();
        
        // Check permission to export grades from this course
        require_capability('moodle/grade:export', $context);
        
        // Ensure grades are up to date
        grade_regrade_final_grades_if_required($course);
        
        // Parse user IDs
        $userids = [];
        if (!empty($useridsparam)) {
            $userids = explode(',', $useridsparam);
            $userids = array_map('intval', $userids);
        }
        
        // Parse item IDs
        $itemids = [];
        if (!empty($itemidsparam)) {
            $itemids = explode(',', $itemidsparam);
            $itemids = array_map('intval', $itemids);
        }
        
        // Get enrolled users
        if (empty($userids)) {
            $enrolledusers = get_enrolled_users($context, 'moodle/grade:view', 0, 'u.*', null, 0, 0, true);
        } else {
            // Get specific users
            list($insql, $params) = $DB->get_in_or_equal($userids);
            $params[] = $courseid;
            $sql = "SELECT u.*
                    FROM {user} u
                    JOIN {user_enrolments} ue ON u.id = ue.userid
                    JOIN {enrol} e ON ue.enrolid = e.id
                    WHERE u.id $insql AND e.courseid = ? AND u.deleted = 0";
            $enrolledusers = $DB->get_records_sql($sql, $params);
        }
        
        // Get grade items
        if (empty($itemids)) {
            $gradeitems = grade_item::fetch_all(['courseid' => $courseid]);
        } else {
            $gradeitems = [];
            foreach ($itemids as $itemid) {
                $item = grade_item::fetch(['id' => $itemid, 'courseid' => $courseid]);
                if ($item) {
                    $gradeitems[$item->id] = $item;
                }
            }
        }
        
        // Filter out hidden items if requested
        if (!$includehidden && $gradeitems) {
            foreach ($gradeitems as $key => $item) {
                if ($item->hidden) {
                    unset($gradeitems[$key]);
                }
            }
        }
        
        // Build column definitions
        $columns = [
            ['key' => 'userid', 'label' => 'User ID'],
            ['key' => 'firstname', 'label' => 'First Name'],
            ['key' => 'lastname', 'label' => 'Last Name'],
            ['key' => 'email', 'label' => 'Email'],
            ['key' => 'idnumber', 'label' => 'ID Number']
        ];
        
        if ($gradeitems) {
            foreach ($gradeitems as $gradeitem) {
                // Skip course total for export
                if ($gradeitem->itemtype == 'course') {
                    continue;
                }
                
                $columns[] = [
                    'key' => 'item_' . $gradeitem->id,
                    'label' => $gradeitem->get_name()
                ];
                
                if ($includefeedback) {
                    $columns[] = [
                        'key' => 'item_' . $gradeitem->id . '_feedback',
                        'label' => $gradeitem->get_name() . ' (Feedback)'
                    ];
                }
            }
        }
        
        // Build data rows
        $rows = [];
        
        foreach ($enrolledusers as $user) {
            $row = [
                'userid' => $user->id,
                'firstname' => $user->firstname,
                'lastname' => $user->lastname,
                'email' => $user->email,
                'idnumber' => $user->idnumber
            ];
            
            if ($gradeitems) {
                foreach ($gradeitems as $gradeitem) {
                    // Skip course total
                    if ($gradeitem->itemtype == 'course') {
                        continue;
                    }
                    
                    // Get grade for this item
                    $grade = new grade_grade(['itemid' => $gradeitem->id, 'userid' => $user->id]);
                    
                    // Format grade value
                    $gradevalue = $grade->finalgrade !== null 
                        ? grade_format_gradevalue($grade->finalgrade, $gradeitem, true, GRADE_DISPLAY_TYPE_DEFAULT, 2)
                        : '-';
                    
                    $row['item_' . $gradeitem->id] = $gradevalue;
                    
                    if ($includefeedback) {
                        $row['item_' . $gradeitem->id . '_feedback'] = $grade->feedback ? $grade->feedback : '';
                    }
                }
            }
            
            $rows[] = $row;
        }
        
        // Build response
        $response = [
            'course' => [
                'id' => $course->id,
                'fullname' => $course->fullname,
                'shortname' => $course->shortname,
                'idnumber' => $course->idnumber
            ],
            'format' => $format,
            'export_time' => time(),
            'columns' => $columns,
            'rows' => $rows,
            'user_count' => count($rows),
            'item_count' => count($columns) - 5 // Subtract user info columns
        ];
        
        // Add CSV format if requested
        if ($format === 'csv') {
            $response['csv'] = $this->array_to_csv($columns, $rows);
        }
        
        ApiResponse::success($response);
    }
    
    /**
     * Handle POST request - not supported for this endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for gradebook export endpoint');
    }
    
    /**
     * Handle PUT request - not supported for this endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for gradebook export endpoint');
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for gradebook export endpoint');
    }
}

// Instantiate and handle the request
if (!defined('API_TEST_MODE')) {
    $endpoint = new GradebookExportEndpoint();
    $endpoint->handle_request();
}
