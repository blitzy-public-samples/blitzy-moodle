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
 * REST API endpoint for retrieving role capability definitions and permissions.
 *
 * This endpoint returns the complete capability array for a specific role in a given
 * context, including capability names, permission levels (inherit/allow/prevent/prohibit),
 * and context information. It wraps the existing role_context_capabilities() function
 * from lib/accesslib.php following the thin wrapper pattern.
 *
 * Endpoint: GET /api/v1/admin/roles/capabilities
 * Query Parameters:
 *   - roleid (required, int): The role ID to retrieve capabilities for
 *   - contextid (optional, int): Context ID to check capabilities in (defaults to system context)
 *
 * Authentication: JWT token required (Bearer token in Authorization header)
 * Authorization: Requires moodle/role:view capability in the specified context
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "role": {
 *       "id": 5,
 *       "shortname": "student",
 *       "name": "Student",
 *       "description": "Students generally have fewer privileges within a course",
 *       "archetype": "student"
 *     },
 *     "context": {
 *       "id": 1,
 *       "contextlevel": 10,
 *       "instanceid": 0,
 *       "path": "/1",
 *       "depth": 1
 *     },
 *     "capabilities": {
 *       "moodle/site:config": -1000,
 *       "moodle/course:view": 1,
 *       "moodle/course:create": -1,
 *       "mod/assign:submit": 1,
 *       ...
 *     }
 *   }
 * }
 *
 * Permission Levels:
 *   CAP_INHERIT = 0     (Not set, inherit from parent context)
 *   CAP_ALLOW = 1       (Permission granted)
 *   CAP_PREVENT = -1    (Permission blocked, can be overridden)
 *   CAP_PROHIBIT = -1000 (Permission blocked, cannot be overridden)
 *
 * Error Responses:
 *   400 Bad Request - Invalid roleid or contextid parameter
 *   403 Forbidden - User lacks moodle/role:view capability
 *   404 Not Found - Role ID does not exist in mdl_role table
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../../config.php');
require_once($CFG->libdir . '/accesslib.php');

// Load API base class and exception handlers
require_once(__DIR__ . '/../../../lib/api_base.php');
require_once(__DIR__ . '/../../../lib/api_exception.php');

/**
 * RoleCapabilitiesEndpoint class for retrieving role capability definitions.
 *
 * This endpoint extends ApiBase to inherit JWT authentication, HTTP method routing,
 * and response formatting. It wraps the existing role_context_capabilities() function
 * from Moodle's access control library without duplicating any business logic.
 *
 * The endpoint enforces moodle/role:view capability before returning role capability
 * data, ensuring users can only view role definitions they have permission to see.
 */
class RoleCapabilitiesEndpoint extends ApiBase {
    
    /**
     * Constructor - enables authentication for this endpoint.
     *
     * Sets $requireAuth to true to enforce JWT token validation before
     * processing any requests. Only authenticated users can access role
     * capability definitions.
     */
    public function __construct() {
        // Enable authentication requirement
        $this->requireAuth = true;
        
        // Call parent constructor to handle JWT validation
        parent::__construct();
    }
    
    /**
     * Handle GET requests for role capability retrieval.
     *
     * This method processes GET requests to retrieve role capability definitions
     * for a specific role in a given context. It follows the thin wrapper pattern
     * by delegating all business logic to existing Moodle functions.
     *
     * Process flow:
     * 1. Extract and validate roleid parameter (required)
     * 2. Extract and validate contextid parameter (optional, defaults to system context)
     * 3. Verify role exists in mdl_role table
     * 4. Get context instance
     * 5. Enforce moodle/role:view capability
     * 6. Call role_context_capabilities() to get capability array
     * 7. Format and return structured JSON response
     *
     * @return void Outputs JSON response directly via success() method
     * @throws ValidationException If roleid or contextid parameters are invalid
     * @throws NotFoundException If role ID does not exist in database
     * @throws ForbiddenException If user lacks moodle/role:view capability
     */
    protected function handle_get() {
        global $DB;
        
        // Extract roleid parameter (required)
        // PARAM_INT ensures the value is validated as an integer
        $roleid = $this->getParam('roleid', PARAM_INT, true);
        
        // Extract optional contextid parameter (defaults to system context)
        // PARAM_INT ensures the value is validated as an integer if provided
        $contextid = $this->getParam('contextid', PARAM_INT, false, null);
        
        // Validate that role exists in mdl_role table
        // Use $DB->get_record() to fetch role details from existing Moodle database
        $role = $DB->get_record('role', ['id' => $roleid]);
        
        if (!$role) {
            // Role ID does not exist - throw 404 Not Found exception
            throw new NotFoundException('Role not found', [
                'roleid' => $roleid,
                'reason' => 'No role exists with the specified ID'
            ]);
        }
        
        // Get context instance
        // If contextid provided, use context::instance_by_id() to get specific context
        // Otherwise, use context_system::instance() for system-wide context
        try {
            if ($contextid !== null) {
                // Validate and get specific context by ID
                $context = context::instance_by_id($contextid);
            } else {
                // Use system context as default
                $context = context_system::instance();
            }
        } catch (Exception $e) {
            // Context ID is invalid or context does not exist
            throw new ValidationException('Invalid context ID', [
                'contextid' => $contextid,
                'reason' => 'Context does not exist or is invalid',
                'originalError' => $e->getMessage()
            ]);
        }
        
        // Enforce permission check using Moodle's capability system
        // The checkCapability() method from ApiBase will throw ForbiddenException
        // if the user lacks moodle/role:view capability in the specified context
        // This uses the existing require_capability() function internally
        $this->checkCapability('moodle/role:view', $context);
        
        // Call existing Moodle function to get role capabilities
        // role_context_capabilities() is defined in lib/accesslib.php and returns
        // an associative array of capability name => permission level pairs
        // This function handles all the complex logic of:
        // - Loading role definition from database
        // - Resolving capability overrides in the context hierarchy
        // - Computing effective permissions based on role assignments
        // - Handling capability inheritance and prohibition rules
        $capabilities = role_context_capabilities($roleid, $context);
        
        // Build context information object for response
        // Include key context properties that help clients understand the scope
        $contextInfo = [
            'id' => $context->id,
            'contextlevel' => $context->contextlevel,
            'instanceid' => $context->instanceid,
            'path' => $context->path,
            'depth' => $context->depth
        ];
        
        // Add context level name for clarity (system, course, module, etc.)
        $contextlevels = [
            CONTEXT_SYSTEM => 'system',
            CONTEXT_COURSECAT => 'coursecat',
            CONTEXT_COURSE => 'course',
            CONTEXT_MODULE => 'module',
            CONTEXT_BLOCK => 'block',
            CONTEXT_USER => 'user'
        ];
        
        if (isset($contextlevels[$context->contextlevel])) {
            $contextInfo['contextlevelname'] = $contextlevels[$context->contextlevel];
        }
        
        // Build role information object for response
        // Include all relevant role properties from the database record
        $roleInfo = [
            'id' => (int) $role->id,
            'shortname' => $role->shortname,
            'name' => $role->name,
            'description' => $role->description ?? '',
            'archetype' => $role->archetype ?? ''
        ];
        
        // Add role name in current language if different from database name
        // This uses Moodle's language string system to get localized role names
        $rolenameincontext = role_get_name($role, $context);
        if ($rolenameincontext !== $role->name) {
            $roleInfo['localizedName'] = $rolenameincontext;
        }
        
        // Build complete response data structure
        // Organize data into logical sections: role, context, and capabilities
        $data = [
            'role' => $roleInfo,
            'context' => $contextInfo,
            'capabilities' => $capabilities
        ];
        
        // Add metadata about permission levels for client reference
        // This helps clients interpret the numeric permission values
        $data['meta'] = [
            'permissionLevels' => [
                'inherit' => CAP_INHERIT,      // 0: Not set, inherit from parent
                'allow' => CAP_ALLOW,          // 1: Permission granted
                'prevent' => CAP_PREVENT,      // -1: Blocked but can override
                'prohibit' => CAP_PROHIBIT     // -1000: Blocked, cannot override
            ],
            'capabilityCount' => count($capabilities)
        ];
        
        // Return success response with structured data
        // The success() method from ApiBase formats this as proper JSON response
        // with {"success": true, "data": {...}} envelope
        return $this->success($data);
    }
    
    /**
     * Handle POST requests (not supported).
     *
     * This endpoint only supports GET requests. POST requests for role
     * capability modifications should use a separate endpoint with appropriate
     * write permissions (moodle/role:manage).
     *
     * @throws MethodNotAllowedException Always throws as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for role capability retrieval', [
            'allowedMethods' => ['GET'],
            'suggestion' => 'Use GET method to retrieve role capabilities'
        ]);
    }
    
    /**
     * Handle PUT requests (not supported).
     *
     * This endpoint only supports GET requests. Role capability modifications
     * require separate endpoints with moodle/role:manage capability.
     *
     * @throws MethodNotAllowedException Always throws as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for role capability retrieval', [
            'allowedMethods' => ['GET'],
            'suggestion' => 'Use GET method to retrieve role capabilities'
        ]);
    }
    
    /**
     * Handle DELETE requests (not supported).
     *
     * This endpoint only supports GET requests. Role capability modifications
     * require separate endpoints with moodle/role:manage capability.
     *
     * @throws MethodNotAllowedException Always throws as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for role capability retrieval', [
            'allowedMethods' => ['GET'],
            'suggestion' => 'Use GET method to retrieve role capabilities'
        ]);
    }
}

// Instantiate and execute the endpoint
// This creates an instance of RoleCapabilitiesEndpoint which:
// 1. Validates JWT token in constructor (inherited from ApiBase)
// 2. Routes request to appropriate handle_* method based on HTTP method
// 3. Catches exceptions and formats error responses
// 4. Outputs JSON response with CORS headers
$endpoint = new RoleCapabilitiesEndpoint();
$endpoint->execute();
