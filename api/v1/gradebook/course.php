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
 * Course Gradebook API Endpoint
 *
 * GET /api/v1/gradebook/course - Get all grades for a specific course
 *
 * This endpoint provides access to the complete gradebook for a course,
 * including all enrolled users and their grades across all grade items.
 *
 * Required Parameters:
 * - courseid: The ID of the course
 *
 * Optional Parameters:
 * - page: Page number for pagination (default: 1)
 * - perpage: Number of users per page (default: 50, max: 100)
 *
 * Required Capability: moodle/grade:viewall
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "course": {
 *       "id": 5,
 *       "fullname": "Course Name",
 *       "shortname": "COURSE101"
 *     },
 *     "grade_items": [
 *       {
 *         "id": 10,
 *         "itemname": "Assignment 1",
 *         "itemtype": "mod",
 *         "itemmodule": "assign",
 *         "grademax": 100.00,
 *         "grademin": 0.00
 *       }
 *     ],
 *     "users": [
 *       {
 *         "id": 123,
 *         "firstname": "John",
 *         "lastname": "Doe",
 *         "email": "john@example.com",
 *         "grades": [
 *           {
 *             "itemid": 10,
 *             "grade": 85.50,
 *             "str_grade": "85.50",
 *             "percentage": 85.50,
 *             "feedback": ""
 *           }
 *         ],
 *         "course_total": {
 *           "grade": 85.50,
 *           "str_grade": "85.50 / 100.00",
 *           "percentage": 85.50
 *         }
 *       }
 *     ]
 *   },
 *   "meta": {
 *     "pagination": {
 *       "page": 1,
 *       "perpage": 50,
 *       "total": 150,
 *       "totalpages": 3
 *     }
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
 * Course Gradebook Endpoint Class
 *
 * Handles GET requests to retrieve complete gradebook data for a course.
 *
 * @package    core
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class CourseGradebookEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve course gradebook
     *
     * Validates permissions, retrieves all grade items and enrolled users,
     * and returns formatted gradebook data with pagination support.
     *
     * @return void Outputs JSON response
     * @throws ApiException If validation fails or course not found
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Extract and validate parameters
        $courseid = required_param('courseid', PARAM_INT);
        $page = optional_param('page', 1, PARAM_INT);
        $perpage = optional_param('perpage', 50, PARAM_INT);
        
        // Validate pagination parameters
        if ($page < 1) {
            $page = 1;
        }
        if ($perpage < 1 || $perpage > 100) {
            $perpage = 50;
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
        
        // Check permission to view all grades in this course
        require_capability('moodle/grade:viewall', $context);
        
        // Ensure grades are up to date
        grade_regrade_final_grades_if_required($course);
        
        // Get all grade items for this course
        $gradeitems = grade_item::fetch_all(['courseid' => $courseid]);
        $gradeitemsdata = [];
        
        if ($gradeitems) {
            foreach ($gradeitems as $gradeitem) {
                // Skip course total for the items list (it will be included separately)
                if ($gradeitem->itemtype == 'course') {
                    continue;
                }
                
                $gradeitemsdata[] = [
                    'id' => $gradeitem->id,
                    'itemname' => $gradeitem->get_name(),
                    'itemtype' => $gradeitem->itemtype,
                    'itemmodule' => $gradeitem->itemmodule,
                    'iteminstance' => $gradeitem->iteminstance,
                    'grademax' => floatval($gradeitem->grademax),
                    'grademin' => floatval($gradeitem->grademin),
                    'gradepass' => $gradeitem->gradepass ? floatval($gradeitem->gradepass) : null,
                    'aggregationcoef' => floatval($gradeitem->aggregationcoef),
                    'aggregationcoef2' => floatval($gradeitem->aggregationcoef2),
                    'sortorder' => intval($gradeitem->sortorder)
                ];
            }
        }
        
        // Get enrolled users with pagination
        $enrolledusers = get_enrolled_users($context, 'moodle/grade:view', 0, 'u.*', null, 0, 0, true);
        $totalusers = count($enrolledusers);
        $totalpages = ceil($totalusers / $perpage);
        
        // Apply pagination
        $offset = ($page - 1) * $perpage;
        $paginatedusers = array_slice($enrolledusers, $offset, $perpage, true);
        
        // Build user grades data
        $usersdata = [];
        
        foreach ($paginatedusers as $user) {
            // Get all grades for this user in this course
            $grades = grade_get_course_grades($courseid, $user->id);
            
            $usergradesdata = [];
            $coursetotal = null;
            
            if ($gradeitems) {
                foreach ($gradeitems as $gradeitem) {
                    // Get grade for this item
                    $grade = new grade_grade(['itemid' => $gradeitem->id, 'userid' => $user->id]);
                    
                    if ($gradeitem->itemtype == 'course') {
                        // This is the course total
                        $coursetotal = [
                            'grade' => $grade->finalgrade !== null ? floatval($grade->finalgrade) : null,
                            'str_grade' => grade_format_gradevalue($grade->finalgrade, $gradeitem, true),
                            'percentage' => $grade->finalgrade !== null && $gradeitem->grademax > 0 
                                ? round(($grade->finalgrade / $gradeitem->grademax) * 100, 2) 
                                : null,
                            'feedback' => $grade->feedback,
                            'timemodified' => $grade->timemodified ? intval($grade->timemodified) : null
                        ];
                    } else {
                        // Regular grade item
                        $usergradesdata[] = [
                            'itemid' => $gradeitem->id,
                            'itemname' => $gradeitem->get_name(),
                            'grade' => $grade->finalgrade !== null ? floatval($grade->finalgrade) : null,
                            'str_grade' => grade_format_gradevalue($grade->finalgrade, $gradeitem, true),
                            'percentage' => $grade->finalgrade !== null && $gradeitem->grademax > 0 
                                ? round(($grade->finalgrade / $gradeitem->grademax) * 100, 2) 
                                : null,
                            'feedback' => $grade->feedback,
                            'timemodified' => $grade->timemodified ? intval($grade->timemodified) : null
                        ];
                    }
                }
            }
            
            $usersdata[] = [
                'id' => $user->id,
                'firstname' => $user->firstname,
                'lastname' => $user->lastname,
                'email' => $user->email,
                'idnumber' => $user->idnumber,
                'grades' => $usergradesdata,
                'course_total' => $coursetotal
            ];
        }
        
        // Build response
        $response = [
            'course' => [
                'id' => $course->id,
                'fullname' => $course->fullname,
                'shortname' => $course->shortname,
                'idnumber' => $course->idnumber
            ],
            'grade_items' => $gradeitemsdata,
            'users' => $usersdata
        ];
        
        $meta = [
            'pagination' => [
                'page' => $page,
                'perpage' => $perpage,
                'total' => $totalusers,
                'totalpages' => $totalpages
            ]
        ];
        
        ApiResponse::success($response, $meta);
    }
    
    /**
     * Handle POST request - not supported for this endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always throws
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for course gradebook endpoint');
    }
    
    /**
     * Handle PUT request - not supported for this endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always throws
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for course gradebook endpoint');
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always throws
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for course gradebook endpoint');
    }
}

// Instantiate and handle the request
if (!defined('API_TEST_MODE')) {
    $endpoint = new CourseGradebookEndpoint();
    $endpoint->handle_request();
}
