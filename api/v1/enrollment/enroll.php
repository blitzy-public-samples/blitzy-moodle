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
 * API endpoint for enrolling users in courses.
 *
 * This endpoint provides a REST API wrapper around Moodle's enrollment plugin
 * system. It delegates all enrollment logic to the existing enrol_plugin->enrol_user()
 * method without reimplementing any business logic.
 *
 * @route      POST /api/v1/enrollment/enroll
 * @capability enrol/{plugin}:enrol or moodle/course:enrolconfig
 * @body       {courseid: int, userid: int, enrolid: int, roleid?: int, timestart?: int, timeend?: int, status?: int}
 * @response   {result: true, enrolmentid: int, userid: int, courseid: int}
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/enrollib.php');

// Include API base class and exception handlers
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Enrollment API endpoint class.
 *
 * Handles POST requests to /api/v1/enrollment/enroll for enrolling users in courses.
 * Validates JWT authentication, checks enrollment permissions, and delegates enrollment
 * operations to existing Moodle enrollment plugins via enrol_plugin->enrol_user().
 *
 * Request Body Parameters:
 * - courseid (int, required): ID of the course to enroll the user in
 * - userid (int, required): ID of the user to enroll
 * - enrolid (int, required): ID of the enrollment instance to use
 * - roleid (int, optional): ID of the role to assign (defaults to student role)
 * - timestart (int, optional): Unix timestamp for enrollment start (default: 0)
 * - timeend (int, optional): Unix timestamp for enrollment end (default: 0)
 * - status (int, optional): Enrollment status (null for active, ENROL_USER_SUSPENDED for suspended)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "result": true,
 *     "enrolmentid": 123,
 *     "userid": 45,
 *     "courseid": 10
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Missing or invalid parameters
 * - 401 Unauthorized: Invalid or missing JWT token
 * - 403 Forbidden: User lacks enrollment permission
 * - 404 Not Found: Course, user, or enrollment instance not found
 * - 500 Internal Server Error: Enrollment plugin not available
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class EnrollEndpoint extends ApiBase {
    
    /**
     * Handle GET requests (not supported for this endpoint).
     *
     * Enrollment operations use POST method. GET requests are rejected
     * with 405 Method Not Allowed.
     *
     * @throws MethodNotAllowedException Always, as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method is not supported for enrollment operations', [
            'allowedMethods' => ['POST'],
            'endpoint' => '/api/v1/enrollment/enroll'
        ]);
    }
    
    /**
     * Handle POST requests to enroll a user in a course.
     *
     * This method implements the thin wrapper pattern, delegating all enrollment
     * logic to the existing Moodle enrollment plugin system via enrol_plugin->enrol_user().
     * It performs the following steps:
     *
     * 1. Extract and validate JSON request parameters
     * 2. Verify course, user, and enrollment instance exist
     * 3. Get the enrollment plugin instance
     * 4. Check user has enrollment management capability
     * 5. Resolve default role if not provided
     * 6. Call plugin's enrol_user() method to perform enrollment
     * 7. Return success response with enrollment details
     *
     * All business logic (user_enrolments record creation, role assignment, grade
     * initialization, event triggering) is handled by the existing plugin method.
     *
     * @return void Outputs JSON response via success() or error()
     * @throws ValidationException If parameters are invalid or missing
     * @throws ForbiddenException If user lacks enrollment permission
     * @throws NotFoundException If course, user, or instance not found
     * @throws ServerException If enrollment plugin is not available
     */
    protected function handle_post() {
        global $DB;
        
        try {
            // Step 1: Extract and validate JSON request body parameters
            $body = $this->getJsonBody();
            
            // Validate required parameters are present
            if (!isset($body['courseid'])) {
                throw new ValidationException('Missing required parameter: courseid', [
                    'field' => 'courseid',
                    'required' => true
                ]);
            }
            
            if (!isset($body['userid'])) {
                throw new ValidationException('Missing required parameter: userid', [
                    'field' => 'userid',
                    'required' => true
                ]);
            }
            
            if (!isset($body['enrolid'])) {
                throw new ValidationException('Missing required parameter: enrolid', [
                    'field' => 'enrolid',
                    'required' => true
                ]);
            }
            
            // Clean and validate parameter types using Moodle's clean_param()
            $courseid = clean_param($body['courseid'], PARAM_INT);
            $userid = clean_param($body['userid'], PARAM_INT);
            $enrolid = clean_param($body['enrolid'], PARAM_INT);
            
            // Validate numeric parameters are valid integers
            if (!$courseid || $courseid <= 0) {
                throw new ValidationException('Invalid courseid: must be a positive integer', [
                    'field' => 'courseid',
                    'value' => $body['courseid']
                ]);
            }
            
            if (!$userid || $userid <= 0) {
                throw new ValidationException('Invalid userid: must be a positive integer', [
                    'field' => 'userid',
                    'value' => $body['userid']
                ]);
            }
            
            if (!$enrolid || $enrolid <= 0) {
                throw new ValidationException('Invalid enrolid: must be a positive integer', [
                    'field' => 'enrolid',
                    'value' => $body['enrolid']
                ]);
            }
            
            // Extract optional parameters with defaults
            $roleid = isset($body['roleid']) ? clean_param($body['roleid'], PARAM_INT) : null;
            $timestart = isset($body['timestart']) ? clean_param($body['timestart'], PARAM_INT) : 0;
            $timeend = isset($body['timeend']) ? clean_param($body['timeend'], PARAM_INT) : 0;
            $status = isset($body['status']) ? clean_param($body['status'], PARAM_INT) : null;
            
            // Validate optional roleid if provided
            if ($roleid !== null && $roleid <= 0) {
                throw new ValidationException('Invalid roleid: must be a positive integer', [
                    'field' => 'roleid',
                    'value' => $body['roleid']
                ]);
            }
            
            // Step 2: Verify course exists in database
            $course = $DB->get_record('course', ['id' => $courseid], '*', IGNORE_MISSING);
            if (!$course) {
                throw new NotFoundException('Course not found', [
                    'courseid' => $courseid,
                    'reason' => 'No course exists with the specified ID'
                ]);
            }
            
            // Step 3: Verify user exists in database
            $user = $DB->get_record('user', ['id' => $userid], '*', IGNORE_MISSING);
            if (!$user) {
                throw new NotFoundException('User not found', [
                    'userid' => $userid,
                    'reason' => 'No user exists with the specified ID'
                ]);
            }
            
            // Verify user is not deleted
            if ($user->deleted) {
                throw new ValidationException('Cannot enroll deleted user', [
                    'userid' => $userid,
                    'reason' => 'User account has been deleted'
                ]);
            }
            
            // Step 4: Retrieve enrollment instance and verify it belongs to the course
            $instance = $DB->get_record('enrol', ['id' => $enrolid, 'courseid' => $courseid], '*', IGNORE_MISSING);
            if (!$instance) {
                throw new NotFoundException('Enrollment instance not found', [
                    'enrolid' => $enrolid,
                    'courseid' => $courseid,
                    'reason' => 'No enrollment instance exists with the specified ID for this course'
                ]);
            }
            
            // Verify enrollment instance is enabled
            if ($instance->status != ENROL_INSTANCE_ENABLED) {
                throw new ValidationException('Enrollment instance is disabled', [
                    'enrolid' => $enrolid,
                    'status' => $instance->status,
                    'reason' => 'The enrollment method is not currently active'
                ]);
            }
            
            // Step 5: Get enrollment plugin instance
            $plugin = enrol_get_plugin($instance->enrol);
            if (!$plugin) {
                throw new ServerException('Enrollment plugin not available', [
                    'pluginName' => $instance->enrol,
                    'enrolid' => $enrolid,
                    'reason' => 'The enrollment plugin is not installed or enabled'
                ]);
            }
            
            // Step 6: Create course context for capability checking
            $context = context_course::instance($courseid);
            
            // Step 7: Check enrollment capability
            // Different plugins may require different capabilities
            // Try the plugin-specific capability first, fall back to general enrollment config
            $pluginCapability = "enrol/{$instance->enrol}:enrol";
            $generalCapability = 'moodle/course:enrolconfig';
            
            // Check if user has either the plugin-specific or general enrollment capability
            $hasPluginCapability = has_capability($pluginCapability, $context, $this->getUser()->id, false);
            $hasGeneralCapability = has_capability($generalCapability, $context, $this->getUser()->id, false);
            
            if (!$hasPluginCapability && !$hasGeneralCapability) {
                throw new ForbiddenException('Permission denied: insufficient enrollment privileges', [
                    'requiredCapabilities' => [$pluginCapability, $generalCapability],
                    'contextId' => $context->id,
                    'userId' => $this->getUser()->id,
                    'reason' => 'You do not have permission to enroll users in this course'
                ]);
            }
            
            // Step 8: Resolve default role if not provided
            if ($roleid === null) {
                // Get default student role
                $studentRoles = get_archetype_roles('student');
                if (empty($studentRoles)) {
                    throw new ValidationException('No default role available', [
                        'reason' => 'No student role is configured and no role was specified',
                        'suggestion' => 'Please provide a roleid parameter'
                    ]);
                }
                
                // Use the first student role found
                $studentRole = reset($studentRoles);
                $roleid = $studentRole->id;
            } else {
                // Verify the specified role exists
                $role = $DB->get_record('role', ['id' => $roleid], '*', IGNORE_MISSING);
                if (!$role) {
                    throw new ValidationException('Invalid role specified', [
                        'roleid' => $roleid,
                        'reason' => 'No role exists with the specified ID'
                    ]);
                }
            }
            
            // Step 9: Call existing Moodle enrollment plugin method
            // This is the thin wrapper pattern - we delegate ALL enrollment logic
            // to the existing plugin, which will:
            // - Create user_enrolments record
            // - Assign the role in the course context
            // - Initialize grade items if needed
            // - Trigger enrollment events
            // - Handle all business rules
            $plugin->enrol_user($instance, $userid, $roleid, $timestart, $timeend, $status);
            
            // Step 10: Retrieve the created user_enrolments record to get enrollment ID
            $userenrolment = $DB->get_record('user_enrolments', [
                'enrolid' => $enrolid,
                'userid' => $userid
            ], '*', IGNORE_MISSING);
            
            if (!$userenrolment) {
                throw new ServerException('Enrollment failed', [
                    'reason' => 'User enrollment record was not created',
                    'userid' => $userid,
                    'enrolid' => $enrolid
                ]);
            }
            
            // Step 11: Return success response with enrollment details
            $this->success([
                'result' => true,
                'enrolmentid' => $userenrolment->id,
                'userid' => $userid,
                'courseid' => $courseid,
                'roleid' => $roleid,
                'timestart' => $userenrolment->timestart,
                'timeend' => $userenrolment->timeend,
                'status' => $userenrolment->status
            ], 201);
            
        } catch (ApiException $e) {
            // Re-throw API exceptions to be handled by execute()
            throw $e;
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to API exceptions
            throw new ForbiddenException($e->getMessage(), [
                'errorcode' => $e->errorcode,
                'module' => $e->module ?? 'moodle',
                'originalException' => get_class($e)
            ]);
            
        } catch (Exception $e) {
            // Wrap unexpected exceptions
            throw new ServerException('Unexpected error during enrollment', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
        }
    }
    
    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * Enrollment operations use POST method. PUT requests are rejected
     * with 405 Method Not Allowed.
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for enrollment operations', [
            'allowedMethods' => ['POST'],
            'endpoint' => '/api/v1/enrollment/enroll'
        ]);
    }
    
    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * Enrollment operations use POST method. DELETE requests are rejected
     * with 405 Method Not Allowed. Use the unenroll endpoint to remove enrollments.
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for enrollment operations', [
            'allowedMethods' => ['POST'],
            'endpoint' => '/api/v1/enrollment/enroll',
            'suggestion' => 'Use POST /api/v1/enrollment/unenroll to remove enrollments'
        ]);
    }
}

// Execute the endpoint if called directly
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new EnrollEndpoint();
    $endpoint->execute();
}
