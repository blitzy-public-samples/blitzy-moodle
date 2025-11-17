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
 * Self-enrollment API endpoint.
 *
 * Provides REST API for user self-enrollment in courses with self-enrollment
 * plugin enabled. Wraps existing enrol_self_plugin->enrol_self() method with
 * JWT authentication and JSON API interface.
 *
 * @route   POST /api/v1/enrollment/self/{courseid}
 * @body    {password?: string} - Optional enrollment key/password
 * @response {result: boolean, enrolmentid: number, courseid: number, message: string}
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and required libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/moodlelib.php');
require_once($CFG->libdir . '/enrollib.php');
require_once($CFG->dirroot . '/enrol/self/lib.php');

// Load API base class and exceptions
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Self-enrollment endpoint class.
 *
 * Handles POST requests for user self-enrollment in courses. Delegates all
 * enrollment validation and processing to existing enrol_self_plugin methods
 * to maintain backward compatibility and reuse tested business logic.
 *
 * Validation performed by existing Moodle functions:
 * - Enrollment instance enabled status
 * - Enrollment date restrictions (start/end dates)
 * - Cohort membership requirements
 * - Maximum enrollment limit
 * - User capability checks (enrol/self:enrolself)
 * - Enrollment key/password validation
 * - Group enrollment key matching
 *
 * Business logic delegated to:
 * - enrol_self_plugin->can_self_enrol() - Validates all enrollment restrictions
 * - enrol_self_plugin->enrol_self() - Performs actual enrollment with group handling
 * - enrol_plugin->enrol_user() - Creates user_enrolments record
 *
 * @package    core
 * @subpackage api
 */
class SelfEnrollEndpoint extends ApiBase {
    
    /**
     * Handle POST request for self-enrollment.
     *
     * Processes user self-enrollment request by extracting courseid from URI,
     * validating enrollment instance and restrictions, optionally checking
     * enrollment key, and delegating to enrol_self_plugin for enrollment.
     *
     * Request flow:
     * 1. Extract courseid from URI path using regex pattern matching
     * 2. Parse optional password/enrollment key from JSON request body
     * 3. Verify course exists in database
     * 4. Get authenticated user from JWT token
     * 5. Check if user is already enrolled in course
     * 6. Find enabled self-enrollment instance for the course
     * 7. Get self-enrollment plugin instance
     * 8. Validate enrollment is allowed (dates, cohort, max users, capability)
     * 9. Validate enrollment key/password if required by instance
     * 10. Perform self-enrollment via plugin method
     * 11. Retrieve created user_enrolments record
     * 12. Return success response with enrollment details
     *
     * Error handling:
     * - NotFoundException: Course not found, no self-enrollment instance, or plugin missing
     * - ValidationException: User already enrolled
     * - ForbiddenException: Enrollment restricted or invalid key
     * - UnauthorizedException: JWT token invalid (handled by ApiBase)
     *
     * @return void Outputs JSON response directly via success() method
     * @throws NotFoundException If course, instance, or plugin not found
     * @throws ValidationException If user already enrolled
     * @throws ForbiddenException If enrollment restrictions violated or invalid key
     */
    protected function handle_post() {
        global $DB, $USER;
        
        try {
            // Extract courseid from URI path (e.g., /api/v1/enrollment/self/123)
            // Pattern: /api/v1/enrollment/self/{courseid}
            if (!preg_match('#/enrollment/self/(\d+)$#', $this->requestUri, $matches)) {
                throw new ValidationException('Invalid request URI format', [
                    'expected' => '/api/v1/enrollment/self/{courseid}',
                    'received' => $this->requestUri,
                    'reason' => 'courseid must be numeric'
                ]);
            }
            
            $courseid = (int)$matches[1];
            
            // Validate courseid is positive integer
            if ($courseid <= 0) {
                throw new ValidationException('Invalid course ID', [
                    'courseid' => $courseid,
                    'reason' => 'Course ID must be a positive integer'
                ]);
            }
            
            // Parse JSON request body for optional enrollment key
            // Body may be empty or contain: {password: "enrollment-key"}
            $password = null;
            
            // Only parse body if Content-Type is application/json
            $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
            $contentType = trim(explode(';', $contentType)[0]);
            
            if ($contentType === 'application/json') {
                try {
                    $requestData = $this->getJsonBody();
                    $password = $requestData['password'] ?? null;
                } catch (ValidationException $e) {
                    // Empty body or invalid JSON is acceptable if no password required
                    // We'll validate password requirement later based on instance settings
                    $password = null;
                }
            }
            
            // Verify course exists in database
            $course = $DB->get_record('course', ['id' => $courseid], '*', IGNORE_MISSING);
            
            if (!$course) {
                throw new NotFoundException('Course not found', [
                    'courseid' => $courseid,
                    'reason' => 'No course exists with the specified ID'
                ]);
            }
            
            // Get authenticated user from JWT token
            $user = $this->getUser();
            
            // Set global $USER for Moodle core functions that depend on it
            // This is required for enrollment plugin methods
            $USER = $user;
            
            // Create course context for permission checks
            $context = context_course::instance($courseid);
            
            // Check if user is already enrolled in this course
            // Use is_enrolled() to check active enrollment
            if (is_enrolled($context, $user, '', true)) {
                throw new ValidationException('User is already enrolled in this course', [
                    'courseid' => $courseid,
                    'userid' => $user->id,
                    'reason' => 'Cannot self-enroll when already enrolled'
                ]);
            }
            
            // Get all enrollment instances for this course
            $instances = enrol_get_instances($courseid, true);
            
            // Find enabled self-enrollment instance
            $selfinstance = null;
            foreach ($instances as $instance) {
                if ($instance->enrol === 'self' && $instance->status == ENROL_INSTANCE_ENABLED) {
                    $selfinstance = $instance;
                    break;
                }
            }
            
            // Throw exception if no enabled self-enrollment instance found
            if ($selfinstance === null) {
                throw new NotFoundException('No active self-enrollment instance found for this course', [
                    'courseid' => $courseid,
                    'reason' => 'Self-enrollment is not enabled or configured for this course'
                ]);
            }
            
            // Get self-enrollment plugin instance
            $plugin = enrol_get_plugin('self');
            
            if (!$plugin) {
                throw new NotFoundException('Self-enrollment plugin not available', [
                    'plugin' => 'enrol_self',
                    'reason' => 'Self-enrollment plugin is not installed or enabled'
                ]);
            }
            
            // Validate enrollment is allowed using plugin's can_self_enrol() method
            // This checks:
            // - Guest user restriction
            // - Already enrolled check
            // - Instance status (enabled)
            // - Enrollment dates (start/end)
            // - New enrollments allowed (customint6)
            // - Maximum enrollment limit (customint3)
            // - Cohort membership requirement (customint5)
            // - User capability (enrol/self:enrolself)
            $enrolstatus = $plugin->can_self_enrol($selfinstance, true);
            
            // can_self_enrol() returns:
            // - true if enrollment allowed
            // - string with error message if not allowed
            // - false if silent failure (should not happen in our use case)
            if ($enrolstatus !== true) {
                // Extract error message (may contain HTML, strip it)
                $errormsg = is_string($enrolstatus) ? strip_tags($enrolstatus) : 'Enrollment not allowed';
                
                throw new ForbiddenException($errormsg, [
                    'courseid' => $courseid,
                    'userid' => $user->id,
                    'instanceid' => $selfinstance->id,
                    'reason' => 'Enrollment restrictions prevent self-enrollment'
                ]);
            }
            
            // Validate enrollment key/password if required by instance
            // Instance password is stored in $instance->password
            // customint1 indicates if password is also used for group enrollment
            if (!empty($selfinstance->password)) {
                // Password is required
                if (empty($password)) {
                    throw new ForbiddenException('Enrollment key is required', [
                        'courseid' => $courseid,
                        'instanceid' => $selfinstance->id,
                        'reason' => 'This course requires an enrollment key to self-enroll'
                    ]);
                }
                
                // Validate password matches instance password
                // Direct comparison is safe as both are plain text strings
                if ($selfinstance->password !== $password) {
                    throw new ForbiddenException('Invalid enrollment key', [
                        'courseid' => $courseid,
                        'instanceid' => $selfinstance->id,
                        'reason' => 'The enrollment key provided does not match'
                    ]);
                }
            }
            
            // Prepare enrollment data object for plugin
            $enrolldata = new stdClass();
            if (!empty($password)) {
                // Pass enrollment password to plugin for group enrollment key matching
                $enrolldata->enrolpassword = $password;
            }
            
            // Perform self-enrollment via plugin method
            // This delegates to existing business logic that:
            // - Creates user_enrolments record
            // - Sets enrollment start/end dates based on instance settings
            // - Adds user to group if password matches group enrollment key
            // - Triggers enrollment events
            // - Shows success notification
            $plugin->enrol_self($selfinstance, $enrolldata);
            
            // Retrieve created user_enrolments record for confirmation
            $userenrolment = $DB->get_record('user_enrolments', [
                'enrolid' => $selfinstance->id,
                'userid' => $user->id
            ], '*', IGNORE_MISSING);
            
            // Verify enrollment was created successfully
            if (!$userenrolment) {
                throw new ServerException('Enrollment record not found after enrollment', [
                    'courseid' => $courseid,
                    'userid' => $user->id,
                    'instanceid' => $selfinstance->id,
                    'reason' => 'Enrollment appears to have failed despite no errors'
                ]);
            }
            
            // Return success response with enrollment details
            $this->success([
                'result' => true,
                'enrolmentid' => (int)$userenrolment->id,
                'courseid' => (int)$courseid,
                'userid' => (int)$user->id,
                'enrolinstanceid' => (int)$selfinstance->id,
                'timestart' => (int)$userenrolment->timestart,
                'timeend' => (int)$userenrolment->timeend,
                'message' => 'Successfully self-enrolled in course'
            ], 201);
            
        } catch (ApiException $e) {
            // Re-throw API exceptions to be handled by ApiBase::execute()
            throw $e;
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to API exceptions
            // This handles exceptions from enrollment functions
            
            // Determine appropriate exception type based on error code
            if (strpos($e->errorcode, 'nopermission') !== false || 
                strpos($e->errorcode, 'capability') !== false) {
                throw new ForbiddenException($e->getMessage(), [
                    'errorcode' => $e->errorcode,
                    'module' => $e->module ?? 'moodle',
                    'reason' => 'Permission denied during enrollment'
                ]);
            } else if (strpos($e->errorcode, 'notfound') !== false) {
                throw new NotFoundException($e->getMessage(), [
                    'errorcode' => $e->errorcode,
                    'module' => $e->module ?? 'moodle',
                    'reason' => 'Required resource not found during enrollment'
                ]);
            } else {
                // Generic validation error for other Moodle exceptions
                throw new ValidationException($e->getMessage(), [
                    'errorcode' => $e->errorcode,
                    'module' => $e->module ?? 'moodle',
                    'reason' => 'Enrollment validation failed'
                ]);
            }
            
        } catch (Exception $e) {
            // Catch unexpected exceptions and convert to server error
            throw new ServerException('Unexpected error during self-enrollment', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'reason' => 'Internal server error'
            ]);
        }
    }
    
    /**
     * Handle unsupported GET requests.
     *
     * Self-enrollment only supports POST method. This method throws an
     * exception for GET requests with helpful error message.
     *
     * @throws MethodNotAllowedException Always thrown for GET requests
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for self-enrollment', [
            'allowedMethods' => ['POST'],
            'reason' => 'Self-enrollment requires POST request with course ID in URI path'
        ]);
    }
    
    /**
     * Handle unsupported PUT requests.
     *
     * Self-enrollment only supports POST method. This method throws an
     * exception for PUT requests with helpful error message.
     *
     * @throws MethodNotAllowedException Always thrown for PUT requests
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for self-enrollment', [
            'allowedMethods' => ['POST'],
            'reason' => 'Self-enrollment requires POST request with course ID in URI path'
        ]);
    }
    
    /**
     * Handle unsupported DELETE requests.
     *
     * Self-enrollment only supports POST method. This method throws an
     * exception for DELETE requests with helpful error message.
     *
     * @throws MethodNotAllowedException Always thrown for DELETE requests
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for self-enrollment', [
            'allowedMethods' => ['POST'],
            'reason' => 'Self-enrollment requires POST request with course ID in URI path. For unenrollment, use the unenroll endpoint.'
        ]);
    }
}

// Instantiate and execute the endpoint
// ApiBase::execute() handles routing, error handling, and response formatting
$endpoint = new SelfEnrollEndpoint();
$endpoint->execute();
