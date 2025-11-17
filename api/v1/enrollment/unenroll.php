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
 * API endpoint for unenrolling a user from a course.
 *
 * Provides POST /api/v1/enrollment/unenroll endpoint that removes a user enrollment
 * from a course by wrapping Moodle's core enrollment management functionality.
 * This is a thin wrapper that delegates all unenrollment logic to the existing
 * course_enrolment_manager without reimplementing enrollment removal, role cleanup,
 * or grade handling.
 *
 * Request format:
 * POST /api/v1/enrollment/unenroll
 * Content-Type: application/json
 * Authorization: Bearer <jwt_token>
 * 
 * Body:
 * {
 *     "ueid": 123  // User enrollment ID from user_enrolments table
 * }
 *
 * Success response (200):
 * {
 *     "success": true,
 *     "data": {
 *         "result": true
 *     }
 * }
 *
 * Error responses:
 * - 400: Validation error (missing/invalid ueid)
 * - 401: Unauthorized (invalid/missing JWT token)
 * - 403: Forbidden (insufficient enrollment management capability)
 * - 404: Not found (user enrollment does not exist)
 * - 500: Server error (unexpected error during unenrollment)
 *
 * Required capabilities:
 * - enrol/{plugin}:unenrol OR moodle/course:enrolconfig
 *   (capability checked by course_enrolment_manager based on enrollment plugin)
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @route      POST /api/v1/enrollment/unenroll
 * @body       {ueid: number}
 * @capability enrol/{plugin}:unenrol
 * @response   {result: boolean}
 */

// Load Moodle configuration and dependencies
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/moodlelib.php');
require_once($CFG->libdir . '/accesslib.php');

// Load API base class and exception handlers
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Unenrollment API endpoint class.
 *
 * Handles POST requests to /api/v1/enrollment/unenroll for removing user enrollments
 * from courses. Extends ApiBase to inherit JWT authentication, request routing,
 * and error handling capabilities.
 *
 * Implementation follows the thin wrapper pattern:
 * - Validates request parameters
 * - Retrieves necessary database records
 * - Enforces capability checks
 * - Delegates to course_enrolment_manager->unenrol_user()
 * - Returns standardized JSON response
 *
 * All business logic including role removal, event triggering, grade handling,
 * and enrollment plugin operations are performed by existing Moodle core functions.
 */
class UnenrollEndpoint extends ApiBase {
    
    /**
     * Handle GET requests - not supported for unenrollment.
     *
     * Unenrollment is a state-changing operation that must use POST.
     * This method throws MethodNotAllowedException to indicate that
     * GET is not an appropriate HTTP method for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for unenrollment', [
            'allowedMethods' => ['POST'],
            'reason' => 'Unenrollment is a state-changing operation that requires POST'
        ]);
    }
    
    /**
     * Handle POST requests to unenroll a user from a course.
     *
     * This method implements the core unenrollment functionality by:
     * 1. Parsing and validating the JSON request body
     * 2. Retrieving the user enrollment record from database
     * 3. Loading associated enrollment instance and course records
     * 4. Creating and validating the course context
     * 5. Instantiating course_enrolment_manager
     * 6. Delegating unenrollment to manager->unenrol_user()
     * 7. Returning success response with result boolean
     *
     * All database operations, capability checks, role cleanup, and event
     * triggering are handled by existing Moodle core functions. This method
     * serves only as a thin API wrapper for RESTful JSON access.
     *
     * @return void Outputs JSON response via success() method
     * @throws ValidationException If ueid parameter is missing or invalid
     * @throws NotFoundException If user enrollment or related records don't exist
     * @throws ForbiddenException If user lacks required enrollment management capability
     */
    protected function handle_post() {
        global $CFG, $DB, $PAGE;
        
        try {
            // Parse JSON request body to extract parameters
            $data = $this->getJsonBody();
            
            // Validate that ueid parameter is provided
            if (!isset($data['ueid'])) {
                throw new ValidationException('Missing required parameter: ueid', [
                    'parameter' => 'ueid',
                    'required' => true,
                    'type' => 'integer',
                    'reason' => 'User enrollment ID must be provided'
                ]);
            }
            
            // Clean and validate ueid as integer
            $ueid = clean_param($data['ueid'], PARAM_INT);
            
            if (!$ueid || $ueid <= 0) {
                throw new ValidationException('Invalid parameter: ueid', [
                    'parameter' => 'ueid',
                    'value' => $data['ueid'],
                    'type' => 'integer',
                    'reason' => 'User enrollment ID must be a positive integer'
                ]);
            }
            
            // Retrieve user enrollment record from database
            // Using MUST_EXIST flag causes moodle_exception if record not found
            try {
                $userenrolment = $DB->get_record('user_enrolments', ['id' => $ueid], '*', MUST_EXIST);
            } catch (moodle_exception $e) {
                throw new NotFoundException("User enrollment not found with ID: {$ueid}", [
                    'ueid' => $ueid,
                    'table' => 'user_enrolments',
                    'reason' => 'The specified user enrollment does not exist'
                ]);
            }
            
            // Extract userid and enrolid from user enrollment record
            $userid = $userenrolment->userid;
            $enrolid = $userenrolment->enrolid;
            
            // Retrieve enrollment instance record
            try {
                $enrol = $DB->get_record('enrol', ['id' => $enrolid], '*', MUST_EXIST);
            } catch (moodle_exception $e) {
                throw new NotFoundException("Enrollment instance not found with ID: {$enrolid}", [
                    'enrolid' => $enrolid,
                    'table' => 'enrol',
                    'reason' => 'The enrollment instance associated with this user enrollment does not exist'
                ]);
            }
            
            // Extract courseid and retrieve course record
            $courseid = $enrol->courseid;
            
            try {
                $course = get_course($courseid);
            } catch (moodle_exception $e) {
                throw new NotFoundException("Course not found with ID: {$courseid}", [
                    'courseid' => $courseid,
                    'reason' => 'The course associated with this enrollment does not exist'
                ]);
            }
            
            // Create course context for capability checking
            $context = context_course::instance($course->id);
            
            // Validate context to ensure it's properly initialized
            self::validate_context($context);
            
            // Load enrollment management library
            require_once($CFG->dirroot . '/enrol/locallib.php');
            
            // Instantiate course enrollment manager
            // This manager handles all enrollment operations including capability checks
            $manager = new course_enrolment_manager($PAGE, $course);
            
            // Attempt to unenroll the user
            // The manager->unenrol_user() method will:
            // 1. Get enrollment plugin and instance
            // 2. Check capability (enrol/{plugin}:unenrol)
            // 3. Verify plugin allows unenrollment
            // 4. Delegate to plugin->unenrol_user()
            // 5. Plugin handles: role removal, grade cleanup, event triggering
            // 6. Return boolean result
            $result = $manager->unenrol_user($userenrolment);
            
            // Check if unenrollment was successful
            if (!$result) {
                // Unenrollment failed - typically due to capability denial or plugin restriction
                throw new ForbiddenException('Failed to unenroll user', [
                    'ueid' => $ueid,
                    'userid' => $userid,
                    'courseid' => $courseid,
                    'enroltype' => $enrol->enrol,
                    'reason' => 'You do not have permission to unenroll users with this enrollment method, or the enrollment method does not allow unenrollment'
                ]);
            }
            
            // Return success response with result
            $this->success([
                'result' => $result
            ], 200);
            
        } catch (ApiException $e) {
            // Re-throw API exceptions to be handled by ApiBase::execute()
            throw $e;
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to API exceptions
            // Most capability denials will be caught here
            throw new ForbiddenException($e->getMessage(), [
                'errorcode' => $e->errorcode,
                'module' => $e->module ?? 'moodle',
                'reason' => 'Permission denied or operation not allowed'
            ]);
            
        } catch (Exception $e) {
            // Catch any unexpected exceptions and convert to server error
            throw new ServerException('Unexpected error during unenrollment', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
        }
    }
    
    /**
     * Handle PUT requests - not supported for unenrollment.
     *
     * Unenrollment uses POST method for consistency with enrollment operations.
     * PUT is reserved for updating enrollment details (e.g., status, timestart, timeend).
     *
     * @throws MethodNotAllowedException Always thrown as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for unenrollment', [
            'allowedMethods' => ['POST'],
            'reason' => 'Use POST to remove enrollment, PUT is for enrollment updates'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for unenrollment.
     *
     * While DELETE might semantically fit unenrollment, this endpoint uses POST
     * for consistency with Moodle's existing enrollment API patterns and to
     * support future request body parameters if needed.
     *
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for unenrollment', [
            'allowedMethods' => ['POST'],
            'reason' => 'Use POST /api/v1/enrollment/unenroll to remove enrollment'
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new UnenrollEndpoint();
$endpoint->execute();
