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
 * API endpoint for listing available enrollment methods for a course.
 *
 * This endpoint provides a RESTful interface to retrieve all enabled enrollment
 * methods (plugins) for a specific course. It wraps Moodle's core enrollment
 * functions without reimplementing any business logic.
 *
 * Supported enrollment plugins include:
 * - manual: Manual enrollment by teachers/admins
 * - self: Self-enrollment with optional enrollment key
 * - cohort: Cohort synchronization
 * - guest: Guest access
 * - ldap: LDAP synchronization
 * - lti: LTI provider enrollment
 * - database: External database enrollment
 * - category: Category-based enrollment
 * - meta: Meta course links
 * - paypal: PayPal payment gateway
 * - And other installed enrollment plugins
 *
 * @route      GET /api/v1/enrollment/methods?courseid={id}
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Load Moodle core enrollment libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/enrollib.php');
require_once($CFG->dirroot . '/course/lib.php');

/**
 * Enrollment methods API endpoint class.
 *
 * Extends ApiBase to provide GET handler at /api/v1/enrollment/methods that
 * returns a list of available enrollment methods for a specified course.
 *
 * The endpoint wraps core_enrol_external::get_course_enrolment_methods()
 * and enrol_get_instances() functions to retrieve enrollment plugin information
 * without duplicating enrollment logic.
 *
 * Example request:
 * GET /api/v1/enrollment/methods?courseid=5
 * Authorization: Bearer <jwt_token>
 *
 * Example response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "courseid": 5,
 *       "type": "manual",
 *       "name": "Manual enrolments",
 *       "status": "enabled",
 *       "wsfunction": "enrol_manual_enrol_users"
 *     },
 *     {
 *       "id": 2,
 *       "courseid": 5,
 *       "type": "self",
 *       "name": "Self enrolment",
 *       "status": "enabled",
 *       "wsfunction": "enrol_self_enrol_user"
 *     }
 *   ]
 * }
 */
class EnrollmentMethodsEndpoint extends ApiBase {
    
    /**
     * Handle GET requests for enrollment methods.
     *
     * Retrieves all enabled enrollment methods for a specified course.
     * Validates JWT token, checks course exists and user has permission to
     * view course information, then delegates to existing Moodle enrollment
     * functions to retrieve method details.
     *
     * Query parameters:
     * - courseid (int, required): Course ID to get enrollment methods for
     *
     * Authorization:
     * - Requires valid JWT token in Authorization header
     * - User must be able to view course information or access the course
     *
     * @return void Outputs JSON response via success() method
     * @throws NotFoundException If course does not exist
     * @throws ForbiddenException If user lacks permission to view course
     * @throws ValidationException If courseid parameter is invalid
     */
    protected function handle_get() {
        global $DB;
        
        try {
            // Extract and validate courseid parameter from query string
            // Uses PARAM_INT to ensure only numeric course IDs are accepted
            $courseid = $this->getParam('courseid', PARAM_INT, true);
            
            // Validate that the course exists in the database
            // MUST_EXIST flag throws exception if course not found
            $course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);
            
            // Check capability to view course enrollment methods
            $coursecontext = context_course::instance($courseid);
            $this->checkCapability('moodle/course:view', $coursecontext);
            
            if (!$course) {
                throw new NotFoundException('Course not found', [
                    'courseid' => $courseid
                ]);
            }
            
            // Validate context for the system-level operation
            // This is required by Moodle's external API validation
            $systemcontext = context_system::instance();
            
            // Check if user has permission to view course information
            // Uses Moodle's core course visibility checking functions:
            // 1. core_course_category::can_view_course_info() - checks category-level visibility
            // 2. can_access_course() - checks if user can access the course
            // User needs either permission to proceed
            $canview = core_course_category::can_view_course_info($course);
            $canaccess = can_access_course($course);
            
            if (!$canview && !$canaccess) {
                throw new ForbiddenException('You do not have permission to view enrollment methods for this course', [
                    'courseid' => $courseid,
                    'reason' => 'User lacks permission to view course information or access course'
                ]);
            }
            
            // Retrieve enrollment methods using existing Moodle functions
            // This is a thin wrapper that delegates to core enrollment system
            $methods = $this->getEnrollmentMethods($courseid);
            
            // Return success response with enrollment methods data
            // HTTP 200 OK with JSON array of enrollment method objects
            $this->success($methods, 200);
            
        } catch (dml_missing_record_exception $e) {
            // Handle database record not found exception
            throw new NotFoundException('Course not found', [
                'courseid' => $courseid,
                'originalError' => $e->getMessage()
            ]);
            
        } catch (moodle_exception $e) {
            // Handle other Moodle exceptions (e.g., permission errors)
            throw new ForbiddenException($e->getMessage(), [
                'courseid' => $courseid,
                'errorcode' => $e->errorcode,
                'originalError' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Get enrollment methods for a course using existing Moodle functions.
     *
     * This method wraps core enrollment functions to retrieve enrollment
     * plugin information without reimplementing enrollment logic. It calls:
     * 1. enrol_get_instances() - get enabled enrollment instances for course
     * 2. enrol_get_plugin() - get enrollment plugin object
     * 3. $plugin->get_enrol_info() - get enrollment information from plugin
     *
     * Each enrollment method object contains:
     * - id: Enrollment instance ID
     * - courseid: Course ID
     * - type: Plugin type (e.g., 'manual', 'self', 'cohort')
     * - name: Human-readable plugin name
     * - status: 'enabled' or 'disabled'
     * - wsfunction: Optional webservice function name for enrollment
     *
     * @param int $courseid Course ID to get enrollment methods for
     * @return array Array of enrollment method objects
     */
    private function getEnrollmentMethods($courseid) {
        $result = [];
        
        // Get all enabled enrollment instances for the course
        // Second parameter true = only get enabled instances
        // This function is from lib/enrollib.php
        $enrolinstances = enrol_get_instances($courseid, true);
        
        // Iterate through each enrollment instance
        foreach ($enrolinstances as $enrolinstance) {
            // Get the enrollment plugin object for this instance
            // enrol_get_plugin() returns the plugin class instance
            $enrolplugin = enrol_get_plugin($enrolinstance->enrol);
            
            // Skip if plugin cannot be loaded (broken plugin)
            if (!$enrolplugin) {
                continue;
            }
            
            // Get enrollment information from the plugin
            // Each plugin implements get_enrol_info() to return enrollment details
            $instanceinfo = $enrolplugin->get_enrol_info($enrolinstance);
            
            // Skip if plugin doesn't return info (disabled or unavailable)
            if (!$instanceinfo) {
                continue;
            }
            
            // Convert stdClass object to associative array
            // This ensures consistent JSON structure in the response
            $result[] = (array) $instanceinfo;
        }
        
        return $result;
    }
    
    /**
     * Handle POST requests (not supported).
     *
     * This endpoint only supports GET requests for retrieving enrollment methods.
     * POST, PUT, and DELETE operations are not supported.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT requests (not supported).
     *
     * This endpoint only supports GET requests for retrieving enrollment methods.
     * POST, PUT, and DELETE operations are not supported.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE requests (not supported).
     *
     * This endpoint only supports GET requests for retrieving enrollment methods.
     * POST, PUT, and DELETE operations are not supported.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
}

// Execute the endpoint if called directly
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new EnrollmentMethodsEndpoint();
    $endpoint->execute();
}
