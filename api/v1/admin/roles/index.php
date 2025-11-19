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
 * REST API endpoint for listing all system roles.
 *
 * This endpoint provides comprehensive role catalog including role IDs, names,
 * descriptions, archetypes, and assignment counts. Supports optional context
 * parameter for context-specific role names. Wraps existing get_all_roles()
 * function from lib/accesslib.php with JWT authentication and JSON response.
 *
 * Endpoint: GET /api/v1/admin/roles
 *
 * Authentication: Required (JWT token)
 * 
 * Capabilities Required:
 * - moodle/role:view - View role definitions
 *
 * Query Parameters:
 * - contextid (optional, integer): Context ID for context-specific role names
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "roles": [
 *       {
 *         "id": 1,
 *         "shortname": "manager",
 *         "name": "Manager",
 *         "description": "Managers can access course and modify settings...",
 *         "archetype": "manager",
 *         "sortorder": 1,
 *         "assignment_count": 5,
 *         "is_deletable": true,
 *         "coursealias": "Course Manager" // If context provided
 *       },
 *       ...
 *     ],
 *     "total": 8
 *   }
 * }
 *
 * Error Responses:
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: User lacks moodle/role:view capability
 * - 400 Bad Request: Invalid contextid parameter
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and initialize environment
// Only require config if not already loaded (for test compatibility)
if (!defined('MOODLE_INTERNAL')) {
    require_once(__DIR__ . '/../../../../config.php');
}

// Load API base class and exception handlers
require_once(__DIR__ . '/../../../lib/api_base.php');
require_once(__DIR__ . '/../../../lib/api_exception.php');

// Load Moodle core libraries for role management
require_once($CFG->libdir . '/accesslib.php');

/**
 * Roles list API endpoint handler.
 *
 * Extends ApiBase to provide GET endpoint for retrieving all system roles
 * with comprehensive details including assignment counts and metadata.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class RolesListEndpoint extends ApiBase {
    
    /**
     * Constructor - initializes authentication requirement.
     *
     * Sets requireAuth to true to enforce JWT token validation before
     * processing any requests to this endpoint.
     */
    public function __construct() {
        // Require authentication for this endpoint
        $this->requireAuth = true;
        
        // Call parent constructor to initialize JWT validation and user authentication
        parent::__construct();
    }
    
    /**
     * Handle GET requests to retrieve all system roles.
     *
     * Retrieves complete catalog of all defined roles in the system using
     * get_all_roles() from Moodle core. Enriches role data with assignment
     * counts, deletability status, and context-specific names if requested.
     *
     * Workflow:
     * 1. Extract optional contextid parameter from query string
     * 2. Get system context and check moodle/role:view capability
     * 3. Validate and load context if contextid provided
     * 4. Fetch all roles using get_all_roles()
     * 5. Process role names using role_fix_names()
     * 6. Enrich each role with assignment counts and metadata
     * 7. Return formatted JSON response with roles array
     *
     * @return void Outputs JSON response directly via success() method
     * @throws ForbiddenException If user lacks moodle/role:view capability
     * @throws ValidationException If contextid is invalid
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Extract optional contextid parameter (not required)
        $contextid = $this->getParam('contextid', PARAM_INT, false, null);
        
        // Get system context for capability check
        $systemcontext = context_system::instance();
        
        // Enforce moodle/role:view capability
        // This uses Moodle's existing permission system via require_capability()
        // If user lacks capability, checkCapability() throws ForbiddenException
        $this->checkCapability('moodle/role:view', $systemcontext);
        
        // Initialize context variable (may be overridden if contextid provided)
        $context = null;
        
        // If contextid provided, validate and load the context
        if ($contextid !== null) {
            try {
                // Validate that context exists using Moodle's context system
                $context = context::instance_by_id($contextid);
                
                // Ensure context is valid (instance_by_id throws exception if not found)
                if (!$context) {
                    throw new ValidationException(
                        'Invalid context ID provided',
                        ['contextid' => $contextid, 'reason' => 'Context does not exist']
                    );
                }
                
            } catch (dml_missing_record_exception $e) {
                // Context not found in database
                throw new ValidationException(
                    'Invalid context ID: Context does not exist',
                    ['contextid' => $contextid, 'originalError' => $e->getMessage()]
                );
                
            } catch (Exception $e) {
                // Any other exception during context loading
                throw new ValidationException(
                    'Failed to load context: ' . $e->getMessage(),
                    ['contextid' => $contextid, 'originalError' => $e->getMessage()]
                );
            }
        }
        
        // Fetch all roles using existing Moodle function
        // Pass context if provided for context-specific role names
        // This calls get_all_roles($context) from lib/accesslib.php
        $roles = get_all_roles($context);
        
        // Process role names using Moodle's role_fix_names function
        // ROLENAME_ORIGINAL preserves original role names with context-specific aliases
        // This enriches roles with localized names and course-specific aliases
        $roles = role_fix_names($roles, $context, ROLENAME_ORIGINAL);
        
        // Initialize enriched roles array for response
        $enrichedRoles = [];
        
        // Identify undeletable system roles from configuration
        // These are protected roles that cannot be removed
        $undeletableRoleIds = [
            $CFG->notloggedinroleid,  // Not logged in role
            $CFG->guestroleid,        // Guest role
            $CFG->defaultuserroleid,  // Authenticated user role
        ];
        
        // Iterate through roles to enrich with additional metadata
        foreach ($roles as $role) {
            // Count role assignments for this role across all contexts
            // Uses Moodle's $DB API to count records in role_assignments table
            $assignmentCount = $DB->count_records('role_assignments', ['roleid' => $role->id]);
            
            // Determine if role is deletable (not a protected system role)
            $isDeletable = !in_array($role->id, $undeletableRoleIds);
            
            // Build enriched role object with all required properties
            $enrichedRole = [
                'id' => (int)$role->id,
                'shortname' => $role->shortname,
                'name' => $role->localname,  // Localized name from role_fix_names()
                'description' => $role->description ?? '',
                'archetype' => $role->archetype ?? '',
                'sortorder' => (int)$role->sortorder,
                'assignment_count' => $assignmentCount,
                'is_deletable' => $isDeletable,
            ];
            
            // If context was provided and course alias exists, include it
            // This provides context-specific role naming (e.g., "Teacher" vs "Instructor")
            if ($context && isset($role->coursealias) && !empty($role->coursealias)) {
                $enrichedRole['coursealias'] = $role->coursealias;
            }
            
            // Add enriched role to response array
            $enrichedRoles[] = $enrichedRole;
        }
        
        // Prepare response data with roles array and total count
        $responseData = [
            'roles' => $enrichedRoles,
            'total' => count($enrichedRoles),
        ];
        
        // Return success response with role catalog
        // This calls ApiResponse::success() via parent::success()
        $this->success($responseData);
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * This endpoint only supports GET requests for retrieving role lists.
     * POST is used for creating roles via a different endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as POST not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException(
            'POST method not supported for role listing',
            ['allowedMethods' => ['GET']]
        );
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * This endpoint only supports GET requests for retrieving role lists.
     * PUT is used for updating roles via a different endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as PUT not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException(
            'PUT method not supported for role listing',
            ['allowedMethods' => ['GET']]
        );
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * This endpoint only supports GET requests for retrieving role lists.
     * DELETE is used for removing roles via a different endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as DELETE not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(
            'DELETE method not supported for role listing',
            ['allowedMethods' => ['GET']]
        );
    }
}

// Instantiate endpoint handler and execute request

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
$endpoint = new RolesListEndpoint();
$endpoint->execute();
}
