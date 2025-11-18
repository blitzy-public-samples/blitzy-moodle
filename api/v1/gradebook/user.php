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
 * User Gradebook API Endpoint
 *
 * GET /api/v1/gradebook/user - Get grades for a specific user across courses
 *
 * This endpoint provides access to a user's grades, either across all enrolled courses
 * or for a specific course. Users can view their own grades (moodle/grade:view) or
 * teachers/admins can view any user's grades (moodle/grade:viewall).
 *
 * Required Parameters:
 * - None (defaults to authenticated user)
 *
 * Optional Parameters:
 * - userid: The ID of the user to view grades for (requires moodle/grade:viewall)
 * - courseid: Filter grades to a specific course
 *
 * Required Capability:
 * - moodle/grade:view (to view own grades)
 * - moodle/grade:viewall (to view other users' grades)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "user": {
 *       "id": 123,
 *       "firstname": "John",
 *       "lastname": "Doe",
 *       "email": "john@example.com"
 *     },
 *     "courses": [
 *       {
 *         "courseid": 5,
 *         "coursename": "Course Name",
 *         "shortname": "COURSE101",
 *         "grade_items": [
 *           {
 *             "id": 10,
 *             "itemname": "Assignment 1",
 *             "itemtype": "mod",
 *             "itemmodule": "assign",
 *             "grade": 85.50,
 *             "str_grade": "85.50",
 *             "percentage": 85.50,
 *             "grademax": 100.00,
 *             "feedback": ""
 *           }
 *         ],
 *         "course_grade": {
 *           "grade": 85.50,
 *           "str_grade": "85.50 / 100.00",
 *           "percentage": 85.50,
 *           "letter": "B+"
 *         }
 *       }
 *     ]
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
 * User Gradebook Endpoint Class
 *
 * Handles GET requests to retrieve grade data for a specific user.
 *
 * @package    core
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class UserGradebookEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve user grades
     *
     * Validates permissions, retrieves all grades for the specified user,
     * and returns formatted grade data organized by course.
     *
     * @return void Outputs JSON response
     * @throws ApiException If validation fails or user not found
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Validate JWT token and get authenticated user
        $authenticateduserid = $this->authenticate_request();
        
        // Extract and validate parameters
        $userid = optional_param('userid', $authenticateduserid, PARAM_INT);
        $courseid = optional_param('courseid', 0, PARAM_INT);
        
        // Verify user exists
        $user = $DB->get_record('user', ['id' => $userid, 'deleted' => 0], '*', MUST_EXIST);
        if (!$user) {
            throw new ApiException('User not found', 'USER_NOT_FOUND', 404);
        }
        
        // Permission check: viewing another user's grades requires viewall capability
        $viewingotheruser = ($userid != $authenticateduserid);
        
        // Get user's enrolled courses (or specific course if provided)
        if ($courseid > 0) {
            // Verify course exists
            $course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);
            if (!$course) {
                throw new ApiException('Course not found', 'COURSE_NOT_FOUND', 404);
            }
            
            $courses = [$course];
        } else {
            // Get all enrolled courses for this user
            $courses = enrol_get_users_courses($userid, true);
        }
        
        $coursesdata = [];
        
        foreach ($courses as $course) {
            // Get course context
            $context = context_course::instance($course->id);
            
            // Check permission for this course
            if ($viewingotheruser) {
                // Viewing another user requires viewall capability
                if (!has_capability('moodle/grade:viewall', $context)) {
                    continue; // Skip courses where user doesn't have permission
                }
            } else {
                // Viewing own grades requires view capability
                require_capability('moodle/grade:view', $context);
            }
            
            // Ensure grades are up to date
            grade_regrade_final_grades_if_required($course);
            
            // Get all grade items for this course
            $gradeitems = grade_item::fetch_all(['courseid' => $course->id]);
            $gradeitemsdata = [];
            $coursegrade = null;
            
            if ($gradeitems) {
                foreach ($gradeitems as $gradeitem) {
                    // Get grade for this item
                    $grade = new grade_grade(['itemid' => $gradeitem->id, 'userid' => $userid]);
                    
                    if ($gradeitem->itemtype == 'course') {
                        // This is the course total
                        $lettergrade = null;
                        if ($grade->finalgrade !== null) {
                            // Try to get letter grade
                            $letters = grade_get_letters($context);
                            if ($letters) {
                                foreach ($letters as $boundary => $letter) {
                                    $percentage = ($grade->finalgrade / $gradeitem->grademax) * 100;
                                    if ($percentage >= $boundary) {
                                        $lettergrade = $letter;
                                        break;
                                    }
                                }
                            }
                        }
                        
                        $coursegrade = [
                            'grade' => $grade->finalgrade !== null ? floatval($grade->finalgrade) : null,
                            'str_grade' => grade_format_gradevalue($grade->finalgrade, $gradeitem, true),
                            'percentage' => $grade->finalgrade !== null && $gradeitem->grademax > 0 
                                ? round(($grade->finalgrade / $gradeitem->grademax) * 100, 2) 
                                : null,
                            'letter' => $lettergrade,
                            'feedback' => $grade->feedback,
                            'timemodified' => $grade->timemodified ? intval($grade->timemodified) : null
                        ];
                    } else {
                        // Regular grade item
                        $gradeitemsdata[] = [
                            'id' => $gradeitem->id,
                            'itemname' => $gradeitem->get_name(),
                            'itemtype' => $gradeitem->itemtype,
                            'itemmodule' => $gradeitem->itemmodule,
                            'iteminstance' => $gradeitem->iteminstance,
                            'grade' => $grade->finalgrade !== null ? floatval($grade->finalgrade) : null,
                            'str_grade' => grade_format_gradevalue($grade->finalgrade, $gradeitem, true),
                            'percentage' => $grade->finalgrade !== null && $gradeitem->grademax > 0 
                                ? round(($grade->finalgrade / $gradeitem->grademax) * 100, 2) 
                                : null,
                            'grademax' => floatval($gradeitem->grademax),
                            'grademin' => floatval($gradeitem->grademin),
                            'gradepass' => $gradeitem->gradepass ? floatval($gradeitem->gradepass) : null,
                            'feedback' => $grade->feedback,
                            'timemodified' => $grade->timemodified ? intval($grade->timemodified) : null
                        ];
                    }
                }
            }
            
            $coursesdata[] = [
                'courseid' => $course->id,
                'coursename' => $course->fullname,
                'shortname' => $course->shortname,
                'idnumber' => $course->idnumber,
                'grade_items' => $gradeitemsdata,
                'course_grade' => $coursegrade
            ];
        }
        
        // Build response
        $response = [
            'user' => [
                'id' => $user->id,
                'firstname' => $user->firstname,
                'lastname' => $user->lastname,
                'email' => $user->email,
                'idnumber' => $user->idnumber
            ],
            'courses' => $coursesdata
        ];
        
        ApiResponse::success($response);
    }
    
    /**
     * Handle POST request - not supported for this endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always throws
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for user gradebook endpoint');
    }
    
    /**
     * Handle PUT request - not supported for this endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always throws
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for user gradebook endpoint');
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always throws
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for user gradebook endpoint');
    }
}

// Instantiate and handle the request
if (!defined('API_TEST_MODE')) {
    $endpoint = new UserGradebookEndpoint();
    $endpoint->handle_request();
}
