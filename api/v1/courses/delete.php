<?php
/**
 * Course Deletion API Endpoint
 *
 * DELETE /api/v1/courses/{id} - Delete an existing course
 *
 * This endpoint provides the ability to delete courses from the system.
 * It wraps the existing Moodle course deletion functionality without
 * duplicating any business logic.
 *
 * @package    api
 * @subpackage v1
 * @copyright  2024 Moodle React Migration
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include required files
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/moodlelib.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/api/lib/api_base.php');
require_once($CFG->dirroot . '/api/lib/api_exception.php');

/**
 * Course Delete Endpoint Handler
 *
 * Handles DELETE requests to remove an existing course.
 * Delegates all business logic to existing Moodle core functions:
 * - delete_course() for course removal with full cleanup
 *
 * URL Parameters:
 * - id: Course ID (required, from URL path)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "message": "Course deleted successfully",
 *     "courseid": 123
 *   }
 * }
 *
 * IMPORTANT: Course deletion is a destructive operation that:
 * - Removes all course content, activities, and user data
 * - Unenrolls all students and teachers
 * - Deletes all grades and submissions
 * - Removes all files associated with the course
 * This operation cannot be undone.
 */
class CoursesDeleteEndpoint extends ApiBase {
    
    /**
     * Handle DELETE requests to remove an existing course.
     *
     * This method:
     * 1. Validates JWT token and extracts authenticated user
     * 2. Extracts and validates course ID from URL path
     * 3. Verifies course exists and user has permission to delete it
     * 4. Calls existing Moodle delete_course() function
     * 5. Returns standardized JSON response confirming deletion
     *
     * @return void Outputs JSON response and exits
     * @throws ApiException If validation fails or user lacks permissions
     */
    protected function handle_delete() {
        global $CFG, $DB;

        try {
            // Get authenticated user from JWT token.
            $user = $this->getUser();
            if (!$user) {
                throw new UnauthorizedException('Authentication required');
            }

            // Extract and validate course ID from URL path parameter.
            $courseid = $this->getParam('id', PARAM_INT, true);

            // Validate that courseid is positive.
            if ($courseid <= 0) {
                throw new ValidationException('Invalid course ID');
            }

            // Prevent deletion of the site course (ID = 1).
            if ($courseid == SITEID) {
                throw new ValidationException('Cannot delete the site course');
            }

            // Verify the course exists.
            try {
                $course = get_course($courseid);
            } catch (dml_missing_record_exception $e) {
                throw new NotFoundException('Course not found');
            }

            // Check if user has permission to delete the course.
            // Course deletion requires moodle/course:delete capability.
            $coursecontext = context_course::instance($courseid);
            $this->checkCapability('moodle/course:delete', $coursecontext);

            // Additional safety check: Verify user also has capability in course category.
            $categorycontext = context_coursecat::instance($course->category);
            if (!has_capability('moodle/course:delete', $categorycontext)) {
                throw new ForbiddenException('You do not have permission to delete courses in this category');
            }

            // Store course information for response before deletion.
            $coursefullname = $course->fullname;
            $courseshortname = $course->shortname;

            // Call existing Moodle function to delete the course.
            // This function handles:
            // - Removing all course modules and activities
            // - Deleting all user data and submissions
            // - Unenrolling all users
            // - Removing all grades and gradebook data
            // - Deleting all files associated with the course
            // - Triggering course_deleted event
            // - Cleaning up all related database records
            $result = delete_course($courseid, false); // false = don't show progress

            if (!$result) {
                throw new ServerException('Failed to delete course: deletion operation returned false');
            }

            // Prepare response data.
            $responsedata = [
                'message' => 'Course deleted successfully',
                'courseid' => $courseid,
                'fullname' => $coursefullname,
                'shortname' => $courseshortname
            ];

            // Return standardized success response confirming deletion.
            // HTTP 200 OK with success message.
            $this->success($responsedata, 200);

        } catch (moodle_exception $e) {
            // Handle Moodle-specific exceptions.
            if (strpos($e->getMessage(), 'nopermission') !== false) {
                throw new ForbiddenException('You do not have permission to delete this course');
            } else if (strpos($e->getMessage(), 'invalidrecord') !== false ||
                       strpos($e->getMessage(), 'notfound') !== false) {
                throw new NotFoundException('Course not found');
            } else if (strpos($e->getMessage(), 'cannotdeletecourse') !== false) {
                throw new ValidationException('This course cannot be deleted: ' . $e->getMessage());
            } else {
                // Generic server error for unexpected Moodle exceptions.
                throw new ServerException('Failed to delete course: ' . $e->getMessage());
            }
        }
    }

    /**
     * Handle GET requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for course deletion');
    }

    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for course deletion');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for course deletion');
    }
}

// Instantiate endpoint and execute request handling.

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new CoursesDeleteEndpoint();
    $endpoint->execute();
}
