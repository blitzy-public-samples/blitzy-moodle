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
 * REST API endpoint for retrieving user courses.
 *
 * GET /api/v1/users/{id}/courses
 *
 * Returns a list of all courses the specified user is enrolled in, including
 * enrollment details, course progress information, and last access times.
 * Enforces appropriate permission checks: users can view their own courses,
 * or must have the 'moodle/user:viewdetails' capability to view another user's courses.
 *
 * This endpoint wraps the existing enrol_get_users_courses() Moodle function
 * to maintain compatibility with all business logic and validation rules.
 *
 * Query Parameters (optional):
 * - returnusercount: boolean - Include enrollment counts for each course
 * - includecategories: boolean - Include category details for each course
 *
 * Response format:
 * <code>
 * {
 *   "success": true,
 *   "data": {
 *     "courses": [
 *       {
 *         "id": 5,
 *         "fullname": "Introduction to Programming",
 *         "shortname": "CS101",
 *         "category": 2,
 *         "categoryname": "Computer Science",
 *         "visible": 1,
 *         "format": "topics",
 *         "progress": 45.5,
 *         "lastaccess": 1640000000,
 *         "enrolledcount": 120
 *       }
 *     ],
 *     "total": 1
 *   }
 * }
 * </code>
 *
 * Error responses:
 * - 400: Invalid user ID parameter
 * - 401: Unauthorized (invalid or missing JWT token)
 * - 403: Forbidden (insufficient permissions to view user's courses)
 * - 404: User not found or deleted
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/moodlelib.php');
require_once($CFG->dirroot . '/lib/enrollib.php');
require_once($CFG->dirroot . '/lib/accesslib.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->libdir . '/completionlib.php');

// Load API utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * User Courses API endpoint class.
 *
 * Handles GET requests to retrieve all courses a user is enrolled in.
 * Extends ApiBase to inherit JWT authentication, permission checking,
 * parameter validation, and response formatting capabilities.
 */
class UserCoursesEndpoint extends ApiBase {
    
    /**
     * Handle GET request for user courses.
     *
     * Retrieves all courses the specified user is enrolled in, with enriched
     * data including progress tracking (if enabled) and last access times.
     * Filters out hidden courses if the viewing user doesn't have permission
     * to see them.
     *
     * @return void Outputs JSON response directly
     * @throws ValidationException If user ID parameter is invalid
     * @throws NotFoundException If user does not exist or is deleted
     * @throws ForbiddenException If viewing user lacks permission
     */
    protected function handle_get() {
        global $DB, $USER;
        
        try {
            // Get authenticated user from JWT token (handled by parent class)
            $authenticatedUser = $this->getUser();
            
            // Extract and validate user ID from path parameter
            // Expected format: /api/v1/users/{id}/courses
            $userid = $this->getParam('id', PARAM_INT);
            
            // Validate user ID is positive integer
            if ($userid <= 0) {
                throw new ValidationException('Invalid user ID parameter', [
                    'parameter' => 'id',
                    'value' => $userid,
                    'rule' => 'Must be a positive integer'
                ]);
            }
            
            // Retrieve user from database
            $targetUser = $DB->get_record('user', ['id' => $userid]);
            
            // Check if user exists
            if (!$targetUser) {
                throw new NotFoundException('User not found', [
                    'userId' => $userid,
                    'reason' => 'No user with this ID exists in the database'
                ]);
            }
            
            // Check if user is deleted
            if ($targetUser->deleted) {
                throw new NotFoundException('User has been deleted', [
                    'userId' => $userid,
                    'reason' => 'This user account has been deleted and is no longer accessible'
                ]);
            }
            
            // Permission check: Allow viewing own courses, otherwise require capability
            $isViewingOwnCourses = ($userid == $authenticatedUser->id);
            
            if (!$isViewingOwnCourses) {
                // Viewing another user's courses requires moodle/user:viewdetails capability
                $userContext = context_user::instance($userid);
                $this->checkCapability('moodle/user:viewdetails', $userContext);
            }
            
            // Extract optional query parameters
            $returnUserCount = $this->getParam('returnusercount', PARAM_BOOL, false, false);
            $includeCategories = $this->getParam('includecategories', PARAM_BOOL, false, false);
            
            // Call existing Moodle function to retrieve enrolled courses
            // Second parameter (true) requests all course details
            $enrolledCourses = enrol_get_users_courses($userid, true);
            
            // Build enriched course list with additional data
            $courses = [];
            
            foreach ($enrolledCourses as $course) {
                // Check if viewing user can see this course (handle hidden courses)
                $courseContext = context_course::instance($course->id);
                
                // Skip hidden courses if user doesn't have permission to view them
                if (!$course->visible) {
                    // Check if viewing user has capability to view hidden courses
                    if (!has_capability('moodle/course:viewhiddencourses', $courseContext, $authenticatedUser->id)) {
                        continue; // Skip this course
                    }
                }
                
                // Build course data object
                $courseData = [
                    'id' => (int) $course->id,
                    'fullname' => $course->fullname,
                    'shortname' => $course->shortname,
                    'category' => (int) $course->category,
                    'visible' => (int) $course->visible,
                    'format' => $course->format,
                    'startdate' => (int) $course->startdate,
                    'enddate' => (int) $course->enddate,
                ];
                
                // Add category name if requested
                if ($includeCategories) {
                    $category = $DB->get_record('course_categories', ['id' => $course->category], 'name');
                    if ($category) {
                        $courseData['categoryname'] = $category->name;
                    }
                }
                
                // Add course progress if completion tracking is enabled
                if ($course->enablecompletion) {
                    // Load completion information for the target user
                    $completion = new completion_info($course);
                    
                    if ($completion->is_enabled()) {
                        // Get completion percentage for the user
                        $percentage = progress_get_course_progress_percentage($course, $userid);
                        
                        if ($percentage !== null) {
                            $courseData['progress'] = round($percentage, 1);
                        } else {
                            $courseData['progress'] = 0.0;
                        }
                    } else {
                        $courseData['progress'] = null;
                    }
                } else {
                    $courseData['progress'] = null;
                }
                
                // Add last access time for the target user in this course
                $lastAccess = $DB->get_field('user_lastaccess', 'timeaccess', [
                    'userid' => $userid,
                    'courseid' => $course->id
                ]);
                
                $courseData['lastaccess'] = $lastAccess ? (int) $lastAccess : null;
                
                // Add enrollment count if requested
                if ($returnUserCount) {
                    // Count enrolled users in this course
                    $enrolledUserCount = count_enrolled_users($courseContext);
                    $courseData['enrolledcount'] = (int) $enrolledUserCount;
                }
                
                // Add to courses array
                $courses[] = $courseData;
            }
            
            // Build response data
            $responseData = [
                'courses' => $courses,
                'total' => count($courses),
            ];
            
            // Return success response with standardized envelope
            $this->success($responseData, 200);
            
        } catch (ApiException $e) {
            // Re-throw API exceptions to be caught by parent execute() method
            throw $e;
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to API exceptions
            throw new ForbiddenException($e->getMessage(), [
                'errorcode' => $e->errorcode,
                'module' => $e->module ?? 'moodle',
                'originalError' => $e->getMessage()
            ]);
            
        } catch (Exception $e) {
            // Handle unexpected exceptions
            throw new ServerException('Failed to retrieve user courses', [
                'originalError' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
        }
    }
    
    /**
     * POST method not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * PUT method not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * DELETE method not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new UserCoursesEndpoint();
$endpoint->execute();
