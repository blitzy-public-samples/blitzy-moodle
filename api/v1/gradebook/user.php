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
 * GET /api/v1/gradebook/user/{id} - Get grades for a specific user across courses
 *
 * This endpoint provides a thin wrapper around Moodle's existing grade retrieval functions.
 * It calls grade_get_course_grade() from public/grade/querylib.php to obtain grade data
 * for a user across one or more courses. The endpoint enforces proper capability checks
 * (moodle/grade:view for own grades, moodle/grade:viewall for viewing others' grades).
 *
 * URI Pattern:
 * - GET /api/v1/gradebook/user/{userid}
 *
 * Optional Query Parameters:
 * - courseid: integer - Filter grades to a specific course (default: all enrolled courses)
 *
 * Required Capability:
 * - moodle/grade:view (to view own grades in user context)
 * - moodle/grade:viewall (to view other users' grades in system context)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "userid": 123,
 *     "user": {
 *       "id": 123,
 *       "firstname": "John",
 *       "lastname": "Doe",
 *       "email": "john@example.com",
 *       "idnumber": "STU12345"
 *     },
 *     "courses": [
 *       {
 *         "courseid": 5,
 *         "coursename": "Introduction to Programming",
 *         "shortname": "CS101",
 *         "idnumber": "CS-101-2024",
 *         "finalgrade": 85.50,
 *         "str_grade": "85.50",
 *         "rawgrade": 85.50,
 *         "percentage": 85.50,
 *         "letter": "B+",
 *         "locked": false,
 *         "hidden": false,
 *         "feedback": "Good work overall",
 *         "feedbackformat": 1,
 *         "timemodified": 1701234567
 *       }
 *     ]
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid user ID in URI
 * - 403 Forbidden: Missing required capability
 * - 404 Not Found: User does not exist or has been deleted
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('AJAX_SCRIPT', true);
define('NO_MOODLE_COOKIES', true);

require_once(__DIR__ . '/../../../public/config.php');
require_once($CFG->dirroot . '/grade/querylib.php');
require_once($CFG->dirroot . '/grade/lib.php');
require_once($CFG->libdir . '/gradelib.php');
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * User Gradebook Endpoint Class
 *
 * Thin wrapper that delegates all grade retrieval to existing Moodle function
 * grade_get_course_grade() from public/grade/querylib.php. Enforces capability
 * checks before exposing grade data.
 *
 * @package    core
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class UserGradebookEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve user grades across courses
     *
     * This method implements the thin wrapper pattern by:
     * 1. Extracting user ID from URI path using regex
     * 2. Validating user exists in database
     * 3. Determining if authenticated user is viewing own grades or another user's
     * 4. Enforcing appropriate capability (moodle/grade:view or moodle/grade:viewall)
     * 5. Calling existing grade_get_course_grade() function with optional courseid filter
     * 6. Formatting and returning grade data as JSON
     *
     * NO business logic is duplicated - all grade calculations, aggregations,
     * and data retrieval are delegated to existing Moodle core functions.
     *
     * @return void Outputs JSON response via ApiBase::success()
     * @throws ValidationException If user ID in URI is invalid
     * @throws NotFoundException If user does not exist
     * @throws ForbiddenException If user lacks required capability
     */
    protected function handle_get() {
        // Extract user ID from URI path using regex
        // Expected pattern: /api/v1/gradebook/user/{userid}
        $requesturi = $_SERVER['REQUEST_URI'];
        
        if (!preg_match('#/api/v1/gradebook/user/(\d+)#', $requesturi, $matches)) {
            throw new ValidationException('Invalid URI format. Expected: /api/v1/gradebook/user/{userid}');
        }
        
        $userid = intval($matches[1]);
        
        if ($userid <= 0) {
            throw new ValidationException('User ID must be a positive integer');
        }
        
        // Verify user exists and is active using existing Moodle function
        // \core_user::get_user() handles special users (noreply, support) and returns user record
        try {
            $user = \core_user::get_user($userid, '*', MUST_EXIST);
            // Ensure user is not deleted, is confirmed, and is not guest
            \core_user::require_active_user($user);
        } catch (dml_missing_record_exception $e) {
            throw new NotFoundException('User not found');
        } catch (moodle_exception $e) {
            throw new NotFoundException($e->getMessage());
        }
        
        // Get authenticated user from JWT token
        $authuser = $this->getUser();
        $authuserid = $authuser->id;
        
        // Determine if viewing own grades or another user's grades
        $viewingown = ($userid == $authuserid);
        
        // Enforce capability based on whose grades are being viewed
        if ($viewingown) {
            // Viewing own grades: check moodle/grade:view in user context
            $usercontext = context_user::instance($userid);
            $this->checkCapability('moodle/grade:view', $usercontext);
        } else {
            // Viewing another user's grades: check moodle/grade:viewall in system context
            $systemcontext = context_system::instance();
            $this->checkCapability('moodle/grade:viewall', $systemcontext);
        }
        
        // Get optional courseid parameter from query string
        // If provided, filter grades to specific course; otherwise return all courses
        $courseid = $this->getParam('courseid', PARAM_INT, false);
        
        // Call existing Moodle function grade_get_course_grade() from public/grade/querylib.php
        // This function returns grade data for the user across courses
        // Parameters: $userid (int), $courseid (int|array|null)
        // Returns: object|array of grade_grade objects with course information
        if ($courseid) {
            // Single course filter - verify course exists using existing Moodle function
            // get_course() from public/lib/datalib.php validates and retrieves course record
            try {
                $course = get_course($courseid);
            } catch (dml_missing_record_exception $e) {
                throw new NotFoundException('Course not found');
            }
            
            // Call existing function for single course
            $gradedata = grade_get_course_grade($userid, $courseid);
        } else {
            // No filter - get all enrolled courses for this user
            $enrolledcourses = enrol_get_users_courses($userid, true);
            
            if (empty($enrolledcourses)) {
                // User has no course enrollments
                $gradedata = [];
            } else {
                // Get course IDs array
                $courseids = array_keys($enrolledcourses);
                
                // Call existing function with array of course IDs
                $gradedata = grade_get_course_grade($userid, $courseids);
            }
        }
        
        // Format response data
        // grade_get_course_grade() returns an object or array of objects
        // Each object contains: courseid, grade (finalgrade), rawgrade, str_grade, etc.
        $coursesdata = [];
        
        if ($gradedata) {
            // Handle both single object and array of objects
            $gradedataarray = is_array($gradedata) ? $gradedata : [$gradedata];
            
            foreach ($gradedataarray as $coursegrade) {
                // Get course details using existing Moodle function
                // get_course() from public/lib/datalib.php retrieves course record
                try {
                    $course = get_course($coursegrade->courseid);
                } catch (dml_missing_record_exception $e) {
                    // Course not found - skip this grade entry
                    continue;
                }
                
                // Get letter grade if available
                $lettergrade = null;
                if (isset($coursegrade->grade) && $coursegrade->grade !== null) {
                    $coursecontext = context_course::instance($coursegrade->courseid);
                    $lettergrade = grade_format_gradevalue(
                        $coursegrade->grade,
                        $coursegrade->grade_item ?? null,
                        true,
                        GRADE_DISPLAY_TYPE_LETTER
                    );
                }
                
                // Build course grade data structure
                $coursesdata[] = [
                    'courseid' => intval($coursegrade->courseid),
                    'coursename' => $course ? $course->fullname : '',
                    'shortname' => $course ? $course->shortname : '',
                    'idnumber' => $course ? $course->idnumber : '',
                    'finalgrade' => isset($coursegrade->grade) ? floatval($coursegrade->grade) : null,
                    'str_grade' => $coursegrade->str_grade ?? '',
                    'rawgrade' => isset($coursegrade->rawgrade) ? floatval($coursegrade->rawgrade) : null,
                    'percentage' => isset($coursegrade->percentage) ? floatval($coursegrade->percentage) : null,
                    'letter' => $lettergrade,
                    'locked' => isset($coursegrade->locked) ? (bool)$coursegrade->locked : false,
                    'hidden' => isset($coursegrade->hidden) ? (bool)$coursegrade->hidden : false,
                    'feedback' => $coursegrade->feedback ?? '',
                    'feedbackformat' => isset($coursegrade->feedbackformat) ? intval($coursegrade->feedbackformat) : FORMAT_MOODLE,
                    'timemodified' => isset($coursegrade->timemodified) ? intval($coursegrade->timemodified) : null
                ];
            }
        }
        
        // Build final response
        $response = [
            'userid' => intval($userid),
            'user' => [
                'id' => intval($user->id),
                'firstname' => $user->firstname,
                'lastname' => $user->lastname,
                'email' => $user->email,
                'idnumber' => $user->idnumber ?? ''
            ],
            'courses' => $coursesdata
        ];
        
        // Return success response using ApiBase method
        $this->success($response);
    }
    
    /**
     * Handle POST request - not supported
     *
     * @return void
     * @throws MethodNotAllowedException Always
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for user gradebook endpoint');
    }
    
    /**
     * Handle PUT request - not supported
     *
     * @return void
     * @throws MethodNotAllowedException Always
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for user gradebook endpoint');
    }
    
    /**
     * Handle DELETE request - not supported
     *
     * @return void
     * @throws MethodNotAllowedException Always
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for user gradebook endpoint');
    }
}

// Instantiate and execute endpoint (unless in test mode)
if (!defined('API_TEST_MODE')) {
    $endpoint = new UserGradebookEndpoint();
    $endpoint->execute();
}
