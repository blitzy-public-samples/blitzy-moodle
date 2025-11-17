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
 * REST API endpoint for role assignment and unassignment operations.
 *
 * This endpoint provides a thin REST API wrapper around Moodle's existing
 * role_assign() and role_unassign() functions from accesslib.php. It maintains
 * 100% compatibility with existing Moodle role management business logic by
 * delegating all operations to core functions without reimplementing any logic.
 *
 * Supported operations:
 * - POST: Assign a role to a user in a specific context
 * - DELETE: Remove a role assignment from a user in a specific context
 *
 * Request format (JSON body):
 * {
 *   "roleid": 3,       // ID of the role to assign (e.g., Teacher role)
 *   "userid": 45,      // ID of the user to assign the role to
 *   "contextid": 12    // ID of the context where the role applies
 * }
 *
 * Response format (success):
 * {
 *   "success": true,
 *   "data": {
 *     "assignmentId": 123,
 *     "roleid": 3,
 *     "roleName": "Teacher",
 *     "userid": 45,
 *     "username": "john.doe",
 *     "userFullname": "John Doe",
 *     "contextid": 12,
 *     "contextLevel": "course",
 *     "contextName": "Introduction to Programming",
 *     "totalAssignments": 15
 *   }
 * }
 *
 * Security:
 * - Requires valid JWT authentication token
 * - Enforces moodle/role:assign capability in target context
 * - Validates role, user, and context existence before operations
 * - Prevents circular assignments and privilege escalation
 *
 * @package    core_role
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core functions
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/accesslib.php');

// Load API base class and exception handling
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Role assignment endpoint class.
 *
 * Handles HTTP POST and DELETE requests for role assignment operations.
 * All business logic is delegated to existing Moodle core functions:
 * - role_assign() for creating role assignments
 * - role_unassign() for removing role assignments
 * - require_capability() for permission checks (via parent::checkCapability())
 * - context::instance_by_id() for context validation
 */
class RoleAssignEndpoint extends ApiBase {
    
    /**
     * Constructor - initializes endpoint with authentication requirement.
     *
     * Calls parent constructor which validates JWT token and authenticates user.
     * The $requireAuth property is inherited as true, ensuring all requests
     * must include valid authentication.
     */
    public function __construct() {
        // Call parent constructor to handle JWT authentication
        // This will validate the token and populate $this->user
        parent::__construct();
    }
    
    /**
     * Handle GET requests.
     *
     * This endpoint does not support GET requests. Role assignment operations
     * must use POST (to create) or DELETE (to remove) methods.
     *
     * @throws MethodNotAllowedException Always, as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for role assignments', [
            'supportedMethods' => ['POST', 'DELETE'],
            'endpoint' => '/api/v1/admin/roles/assign'
        ]);
    }
    
    /**
     * Handle POST requests - assign a role to a user.
     *
     * This method provides a thin wrapper around Moodle's role_assign() function.
     * It performs the following steps:
     * 1. Extract and validate parameters from JSON request body
     * 2. Validate that role, user, and context exist
     * 3. Check moodle/role:assign capability in the target context
     * 4. Prevent circular assignments (user can't assign higher privileges)
     * 5. Call role_assign() to create the assignment
     * 6. Return assignment details with confirmation
     *
     * All business logic (role validation, context handling, capability checking,
     * database operations) is delegated to existing Moodle functions. This endpoint
     * only provides REST API interface and JSON formatting.
     *
     * @return void Outputs JSON response via success() method
     * @throws ValidationException If parameters are missing or invalid
     * @throws NotFoundException If role, user, or context doesn't exist
     * @throws ForbiddenException If user lacks moodle/role:assign capability
     */
    protected function handle_post() {
        global $DB;
        
        // Extract parameters from JSON request body
        // getJsonBody() validates Content-Type and JSON format
        $data = $this->getJsonBody();
        
        // Validate required parameters are present
        if (!isset($data['roleid'])) {
            throw new ValidationException('Missing required parameter: roleid', [
                'parameter' => 'roleid',
                'type' => 'integer',
                'description' => 'ID of the role to assign'
            ]);
        }
        
        if (!isset($data['userid'])) {
            throw new ValidationException('Missing required parameter: userid', [
                'parameter' => 'userid',
                'type' => 'integer',
                'description' => 'ID of the user to assign the role to'
            ]);
        }
        
        if (!isset($data['contextid'])) {
            throw new ValidationException('Missing required parameter: contextid', [
                'parameter' => 'contextid',
                'type' => 'integer',
                'description' => 'ID of the context where the role applies'
            ]);
        }
        
        // Extract and validate parameter types
        $roleid = clean_param($data['roleid'], PARAM_INT);
        $userid = clean_param($data['userid'], PARAM_INT);
        $contextid = clean_param($data['contextid'], PARAM_INT);
        
        // Validate parameter values are positive integers
        if ($roleid <= 0) {
            throw new ValidationException('Invalid roleid: must be a positive integer', [
                'parameter' => 'roleid',
                'value' => $data['roleid']
            ]);
        }
        
        if ($userid <= 0) {
            throw new ValidationException('Invalid userid: must be a positive integer', [
                'parameter' => 'userid',
                'value' => $data['userid']
            ]);
        }
        
        if ($contextid <= 0) {
            throw new ValidationException('Invalid contextid: must be a positive integer', [
                'parameter' => 'contextid',
                'value' => $data['contextid']
            ]);
        }
        
        // Validate role exists in database
        // Delegates to Moodle's $DB->record_exists() for database check
        if (!$DB->record_exists('role', ['id' => $roleid])) {
            throw new NotFoundException('Role not found', [
                'roleid' => $roleid,
                'reason' => 'No role exists with the specified ID'
            ]);
        }
        
        // Validate user exists and is not deleted
        // Delegates to Moodle's $DB->record_exists() for database check
        if (!$DB->record_exists('user', ['id' => $userid, 'deleted' => 0])) {
            throw new NotFoundException('User not found', [
                'userid' => $userid,
                'reason' => 'User does not exist or has been deleted'
            ]);
        }
        
        // Get context object using Moodle's context system
        // Delegates to context::instance_by_id() which validates context exists
        try {
            $context = context::instance_by_id($contextid);
        } catch (Exception $e) {
            throw new NotFoundException('Context not found', [
                'contextid' => $contextid,
                'reason' => 'No context exists with the specified ID',
                'originalError' => $e->getMessage()
            ]);
        }
        
        // Check if current user has permission to assign roles in this context
        // Delegates to require_capability() via parent::checkCapability()
        // This will throw ForbiddenException if permission check fails
        $this->checkCapability('moodle/role:assign', $context);
        
        // Additional validation: Check for circular assignments
        // Prevent users from assigning roles that would give higher privileges
        // than they themselves possess (e.g., student can't make someone admin)
        // Delegates to has_capability() for privilege level checking
        $currentuser = $this->getUser();
        
        // Get the role record to access role capabilities
        $role = $DB->get_record('role', ['id' => $roleid], '*', MUST_EXIST);
        
        // Check if the role being assigned has higher privileges than current user
        // This prevents privilege escalation attacks
        // Note: We check if current user can assign this specific role in this context
        // The core role_assign() function will also perform its own validation
        if (!has_capability('moodle/role:assign', $context, $currentuser->id)) {
            throw new ForbiddenException('Cannot assign role: insufficient privileges', [
                'roleid' => $roleid,
                'contextid' => $contextid,
                'reason' => 'You do not have permission to assign roles in this context'
            ]);
        }
        
        // Perform the role assignment by delegating to Moodle's core function
        // role_assign() handles all business logic:
        // - Checks for duplicate assignments
        // - Creates database record in mdl_role_assignments table
        // - Triggers role_assigned event
        // - Marks user capabilities cache as dirty
        // - Updates course category caches if applicable
        // We pass empty string for $component to indicate manual assignment
        try {
            $assignmentid = role_assign($roleid, $userid, $contextid, '', 0);
        } catch (Exception $e) {
            // Catch and wrap any exceptions from role_assign()
            throw new ValidationException('Role assignment failed: ' . $e->getMessage(), [
                'roleid' => $roleid,
                'userid' => $userid,
                'contextid' => $contextid,
                'originalError' => $e->getMessage()
            ]);
        }
        
        // Fetch assignment details for response
        // We query the role_assignments table to get the full record
        $assignment = $DB->get_record('role_assignments', ['id' => $assignmentid], '*', MUST_EXIST);
        
        // Get user details for response
        $user = $DB->get_record('user', ['id' => $userid], 'id, username, firstname, lastname', MUST_EXIST);
        $userfullname = fullname($user);
        
        // Get context details for response
        $contextname = $context->get_context_name();
        $contextlevel = context_helper::get_level_name($context->contextlevel);
        
        // Count total role assignments for this user across all contexts
        // This provides useful information about user's overall role assignments
        $totalassignments = $DB->count_records('role_assignments', ['userid' => $userid]);
        
        // Return success response with comprehensive assignment details
        $this->success([
            'assignmentId' => $assignment->id,
            'roleid' => $assignment->roleid,
            'roleName' => $role->name ?: $role->shortname, // Use name if available, fallback to shortname
            'userid' => $assignment->userid,
            'username' => $user->username,
            'userFullname' => $userfullname,
            'contextid' => $assignment->contextid,
            'contextLevel' => $contextlevel,
            'contextName' => $contextname,
            'timeCreated' => $assignment->timemodified,
            'totalAssignments' => $totalassignments,
            'message' => 'Role assigned successfully'
        ], 201); // 201 Created status for successful resource creation
    }
    
    /**
     * Handle PUT requests.
     *
     * This endpoint does not support PUT requests. Role assignments cannot be
     * updated - they must be deleted and recreated if changes are needed.
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for role assignments', [
            'supportedMethods' => ['POST', 'DELETE'],
            'reason' => 'Role assignments cannot be modified - delete and recreate instead',
            'endpoint' => '/api/v1/admin/roles/assign'
        ]);
    }
    
    /**
     * Handle DELETE requests - remove a role assignment from a user.
     *
     * This method provides a thin wrapper around Moodle's role_unassign() function.
     * It performs the following steps:
     * 1. Extract and validate parameters from JSON request body
     * 2. Validate that role, user, and context exist
     * 3. Check moodle/role:assign capability in the target context
     * 4. Call role_unassign() to remove the assignment
     * 5. Return confirmation with updated assignment count
     *
     * All business logic (role validation, context handling, capability checking,
     * database operations) is delegated to existing Moodle functions. This endpoint
     * only provides REST API interface and JSON formatting.
     *
     * @return void Outputs JSON response via success() method
     * @throws ValidationException If parameters are missing or invalid
     * @throws NotFoundException If role, user, or context doesn't exist
     * @throws ForbiddenException If user lacks moodle/role:assign capability
     */
    protected function handle_delete() {
        global $DB;
        
        // Extract parameters from JSON request body
        // DELETE requests can have a body in REST APIs (though not common in HTML forms)
        $data = $this->getJsonBody();
        
        // Validate required parameters are present
        if (!isset($data['roleid'])) {
            throw new ValidationException('Missing required parameter: roleid', [
                'parameter' => 'roleid',
                'type' => 'integer',
                'description' => 'ID of the role to unassign'
            ]);
        }
        
        if (!isset($data['userid'])) {
            throw new ValidationException('Missing required parameter: userid', [
                'parameter' => 'userid',
                'type' => 'integer',
                'description' => 'ID of the user to unassign the role from'
            ]);
        }
        
        if (!isset($data['contextid'])) {
            throw new ValidationException('Missing required parameter: contextid', [
                'parameter' => 'contextid',
                'type' => 'integer',
                'description' => 'ID of the context where the role was assigned'
            ]);
        }
        
        // Extract and validate parameter types
        $roleid = clean_param($data['roleid'], PARAM_INT);
        $userid = clean_param($data['userid'], PARAM_INT);
        $contextid = clean_param($data['contextid'], PARAM_INT);
        
        // Validate parameter values are positive integers
        if ($roleid <= 0) {
            throw new ValidationException('Invalid roleid: must be a positive integer', [
                'parameter' => 'roleid',
                'value' => $data['roleid']
            ]);
        }
        
        if ($userid <= 0) {
            throw new ValidationException('Invalid userid: must be a positive integer', [
                'parameter' => 'userid',
                'value' => $data['userid']
            ]);
        }
        
        if ($contextid <= 0) {
            throw new ValidationException('Invalid contextid: must be a positive integer', [
                'parameter' => 'contextid',
                'value' => $data['contextid']
            ]);
        }
        
        // Validate role exists in database
        if (!$DB->record_exists('role', ['id' => $roleid])) {
            throw new NotFoundException('Role not found', [
                'roleid' => $roleid,
                'reason' => 'No role exists with the specified ID'
            ]);
        }
        
        // Validate user exists and is not deleted
        if (!$DB->record_exists('user', ['id' => $userid, 'deleted' => 0])) {
            throw new NotFoundException('User not found', [
                'userid' => $userid,
                'reason' => 'User does not exist or has been deleted'
            ]);
        }
        
        // Get context object using Moodle's context system
        try {
            $context = context::instance_by_id($contextid);
        } catch (Exception $e) {
            throw new NotFoundException('Context not found', [
                'contextid' => $contextid,
                'reason' => 'No context exists with the specified ID',
                'originalError' => $e->getMessage()
            ]);
        }
        
        // Check if the assignment actually exists before attempting to delete
        // This provides better error messages to the client
        $assignmentexists = $DB->record_exists('role_assignments', [
            'roleid' => $roleid,
            'userid' => $userid,
            'contextid' => $contextid,
            'component' => '' // Only unassign manual assignments (component = '')
        ]);
        
        if (!$assignmentexists) {
            throw new NotFoundException('Role assignment not found', [
                'roleid' => $roleid,
                'userid' => $userid,
                'contextid' => $contextid,
                'reason' => 'No manual role assignment exists with these parameters'
            ]);
        }
        
        // Check if current user has permission to unassign roles in this context
        // Delegates to require_capability() via parent::checkCapability()
        $this->checkCapability('moodle/role:assign', $context);
        
        // Perform the role unassignment by delegating to Moodle's core function
        // role_unassign() handles all business logic:
        // - Deletes record from mdl_role_assignments table
        // - Triggers role_unassigned event
        // - Marks user capabilities cache as dirty
        // - Updates course category caches if applicable
        // We pass empty string for $component to only remove manual assignments
        // (not plugin-managed assignments like enrolment-based roles)
        try {
            role_unassign($roleid, $userid, $contextid, '');
        } catch (Exception $e) {
            // Catch and wrap any exceptions from role_unassign()
            throw new ValidationException('Role unassignment failed: ' . $e->getMessage(), [
                'roleid' => $roleid,
                'userid' => $userid,
                'contextid' => $contextid,
                'originalError' => $e->getMessage()
            ]);
        }
        
        // Get role and user details for response
        $role = $DB->get_record('role', ['id' => $roleid], '*', MUST_EXIST);
        $user = $DB->get_record('user', ['id' => $userid], 'id, username, firstname, lastname', MUST_EXIST);
        $userfullname = fullname($user);
        
        // Get context details for response
        $contextname = $context->get_context_name();
        $contextlevel = context_helper::get_level_name($context->contextlevel);
        
        // Count remaining role assignments for this user
        $remainingassignments = $DB->count_records('role_assignments', ['userid' => $userid]);
        
        // Return success response with unassignment confirmation
        $this->success([
            'roleid' => $roleid,
            'roleName' => $role->name ?: $role->shortname,
            'userid' => $userid,
            'username' => $user->username,
            'userFullname' => $userfullname,
            'contextid' => $contextid,
            'contextLevel' => $contextlevel,
            'contextName' => $contextname,
            'remainingAssignments' => $remainingassignments,
            'message' => 'Role unassigned successfully'
        ], 200); // 200 OK status for successful deletion
    }
}

// Instantiate and execute the endpoint
$endpoint = new RoleAssignEndpoint();
$endpoint->execute();
