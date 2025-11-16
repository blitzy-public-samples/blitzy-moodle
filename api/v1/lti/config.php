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
 * LTI Tool Configuration API Endpoint
 *
 * GET /api/v1/lti/{id}/config
 *
 * Retrieves comprehensive LTI tool type configuration including consumer keys,
 * secrets, custom parameters, capability settings, and LTI version details.
 * Wraps existing Moodle functions lti_get_type_config() and lti_get_type_type_config()
 * to return complete tool configuration for React frontend.
 *
 * This endpoint enforces strict capability checks:
 * - mod/lti:view: Basic configuration access (sensitive fields masked)
 * - mod/lti:manage: Full configuration access (all fields visible)
 *
 * The 'id' parameter can represent either:
 * 1. An LTI tool type ID (direct tool type configuration)
 * 2. An LTI activity instance ID (tool type derived from instance)
 *
 * Sensitive fields (resourcekey, password) are masked with asterisks for users
 * without mod/lti:manage capability to protect OAuth credentials.
 *
 * Response includes:
 * - toolurl: Tool launch endpoint URL
 * - securetoolurl: HTTPS version of tool URL if available
 * - ltiversion: LTI protocol version (LTI-1p0, LTI-1p3, LTI-2p0)
 * - clientid: Client ID for LTI 1.3 tools
 * - resourcekey: OAuth consumer key (masked for non-managers)
 * - password: OAuth shared secret (masked for non-managers)
 * - customparameters: Custom launch parameters in key=value format
 * - sendname: Whether to send user's name to tool (0/1)
 * - sendemailaddr: Whether to send user's email address (0/1)
 * - acceptgrades: Whether tool can send grades back to Moodle (0/1)
 * - allowroster: Whether tool can access course roster (0/1)
 * - forcessl: Whether to force HTTPS for tool communication (0/1)
 * - organizationid: LMS organization identifier sent to tool
 * - organizationurl: Organization website URL
 * - organizationdescr: Organization description
 * - launchcontainer: How tool is displayed (embed, window, etc.)
 * - debuglaunch: Whether to enable debug mode for launches
 * - Additional LTI service configuration parameters (ltiservice_*)
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle React Refactor
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and libraries
// In test environment, these are already loaded by PHPUnit bootstrap or test script
if (!defined('PHPUNIT_TEST') && !defined('API_TEST_MODE')) {
    require_once(__DIR__ . '/../../../config.php');
    require_once($CFG->dirroot . '/mod/lti/lib.php');
    require_once($CFG->dirroot . '/mod/lti/locallib.php');
}

// Load API base class and utilities
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * LTI Tool Configuration Endpoint Handler
 *
 * Handles GET requests to retrieve comprehensive LTI tool type configuration.
 * Extends ApiBase to inherit JWT authentication, capability checking, and
 * standardized response formatting.
 */
class LtiConfigEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve LTI tool configuration.
     *
     * Retrieves comprehensive tool type configuration by calling existing
     * Moodle functions. The 'id' parameter can represent either a tool type ID
     * or an LTI activity instance ID. If an instance ID is provided, the
     * tool type is derived from the instance's typeid field.
     *
     * Process flow:
     * 1. Authenticate user via JWT token (handled by parent class)
     * 2. Extract and validate 'id' parameter
     * 3. Determine if ID is tool type or instance, get tool type ID
     * 4. Retrieve context for capability checking
     * 5. Check mod/lti:view capability (minimum required)
     * 6. Call lti_get_type_type_config() to get full configuration
     * 7. Call lti_get_type_config() to get additional settings
     * 8. Check mod/lti:manage capability to determine field visibility
     * 9. Mask sensitive fields for non-managers
     * 10. Format and return JSON response
     *
     * @return void Outputs JSON response via success() or error()
     * @throws ValidationException If 'id' parameter is missing or invalid
     * @throws NotFoundException If tool type or instance not found
     * @throws ForbiddenException If user lacks required capabilities
     */
    protected function handle_get() {
        global $DB;
        
        // Authenticate user (handled by parent class)
        $user = $this->getUser();
        
        // Get and validate ID parameter (required)
        $id = $this->getParam('id', PARAM_INT, true);
        
        if ($id <= 0) {
            $this->error(
                'INVALID_ID',
                'Invalid LTI ID parameter',
                400,
                ['id' => $id, 'reason' => 'ID must be a positive integer']
            );
            return;
        }
        
        // Determine if ID is a tool type ID or an instance ID
        // Try to fetch as tool type first
        $typeid = null;
        $instanceid = null;
        $context = null;
        
        // Check if ID represents a tool type
        $tooltype = $DB->get_record('lti_types', ['id' => $id]);
        
        if ($tooltype) {
            // ID is a tool type ID
            $typeid = $id;
            
            // For tool types, use system context
            $context = context_system::instance();
            
        } else {
            // Try to fetch as LTI instance
            $ltiinstance = $DB->get_record('lti', ['id' => $id]);
            
            if (!$ltiinstance) {
                $this->error(
                    'NOT_FOUND',
                    'LTI tool type or instance not found',
                    404,
                    ['id' => $id, 'reason' => 'No tool type or instance exists with this ID']
                );
                return;
            }
            
            // ID is an LTI instance ID
            $instanceid = $id;
            
            // Get tool type ID from instance
            $typeid = $ltiinstance->typeid;
            
            // If instance doesn't have a typeid, try to match by URL
            if (empty($typeid)) {
                $tool = lti_get_tool_by_url_match($ltiinstance->toolurl);
                if ($tool) {
                    $typeid = $tool->id;
                }
            }
            
            // Get course module for context
            $cm = get_coursemodule_from_instance('lti', $instanceid, $ltiinstance->course, false, MUST_EXIST);
            $context = context_module::instance($cm->id);
        }
        
        // Validate that we have a valid tool type ID
        if (empty($typeid)) {
            $this->error(
                'NO_TOOL_TYPE',
                'LTI instance does not have an associated tool type',
                400,
                ['instanceId' => $instanceid, 'reason' => 'Instance must be configured with a tool type']
            );
            return;
        }
        
        // Check basic view capability (required for all users)
        try {
            $this->checkCapability('mod/lti:view', $context);
        } catch (Exception $e) {
            // Re-throw as forbidden exception
            $this->error(
                'PERMISSION_DENIED',
                'You do not have permission to view LTI configuration',
                403,
                [
                    'capability' => 'mod/lti:view',
                    'contextId' => $context->id,
                    'userId' => $user->id
                ]
            );
            return;
        }
        
        // Retrieve comprehensive tool type configuration using existing Moodle function
        try {
            $typeconfig = lti_get_type_type_config($typeid);
        } catch (Exception $e) {
            $this->error(
                'CONFIG_ERROR',
                'Failed to retrieve tool type configuration',
                500,
                [
                    'typeid' => $typeid,
                    'error' => $e->getMessage(),
                    'reason' => 'Error calling lti_get_type_type_config()'
                ]
            );
            return;
        }
        
        // Retrieve additional configuration array using existing Moodle function
        try {
            $configarray = lti_get_type_config($typeid);
        } catch (Exception $e) {
            $this->error(
                'CONFIG_ERROR',
                'Failed to retrieve tool configuration array',
                500,
                [
                    'typeid' => $typeid,
                    'error' => $e->getMessage(),
                    'reason' => 'Error calling lti_get_type_config()'
                ]
            );
            return;
        }
        
        // Check if user has manage capability (for sensitive field access)
        $canmanage = false;
        try {
            require_capability('mod/lti:manage', $context, $user->id);
            $canmanage = true;
        } catch (Exception $e) {
            // User does not have manage capability, sensitive fields will be masked
            $canmanage = false;
        }
        
        // Build response object with comprehensive configuration
        $response = new stdClass();
        
        // Basic tool information
        $response->typeid = $typeid;
        $response->typename = $typeconfig->lti_typename ?? null;
        $response->description = $typeconfig->lti_description ?? null;
        
        // Tool URLs
        $response->toolurl = $typeconfig->lti_toolurl ?? $configarray['toolurl'] ?? null;
        $response->securetoolurl = $configarray['securetoolurl'] ?? null;
        
        // LTI version and client configuration
        $response->ltiversion = $typeconfig->lti_ltiversion ?? 'LTI-1p0';
        $response->clientid = $typeconfig->lti_clientid ?? null;
        
        // OAuth credentials (mask if user lacks manage capability)
        if ($canmanage) {
            $response->resourcekey = $typeconfig->lti_resourcekey ?? $configarray['resourcekey'] ?? null;
            $response->password = $typeconfig->lti_password ?? $configarray['password'] ?? null;
        } else {
            // Mask sensitive fields with asterisks
            if (isset($typeconfig->lti_resourcekey) || isset($configarray['resourcekey'])) {
                $response->resourcekey = '********';
            } else {
                $response->resourcekey = null;
            }
            
            if (isset($typeconfig->lti_password) || isset($configarray['password'])) {
                $response->password = '********';
            } else {
                $response->password = null;
            }
        }
        
        // Custom parameters (launch parameters in key=value format)
        $response->customparameters = $typeconfig->lti_customparameters ?? $configarray['customparameters'] ?? null;
        
        // Privacy settings (what user data to send to tool)
        $response->sendname = isset($typeconfig->lti_sendname) ? (int)$typeconfig->lti_sendname : 
                              (isset($configarray['sendname']) ? (int)$configarray['sendname'] : 0);
        $response->sendemailaddr = isset($typeconfig->lti_sendemailaddr) ? (int)$typeconfig->lti_sendemailaddr : 
                                   (isset($configarray['sendemailaddr']) ? (int)$configarray['sendemailaddr'] : 0);
        
        // Grade and roster settings
        $response->acceptgrades = isset($typeconfig->lti_acceptgrades) ? (int)$typeconfig->lti_acceptgrades : 
                                  (isset($configarray['acceptgrades']) ? (int)$configarray['acceptgrades'] : 0);
        $response->allowroster = isset($typeconfig->lti_allowroster) ? (int)$typeconfig->lti_allowroster : 
                                 (isset($configarray['allowroster']) ? (int)$configarray['allowroster'] : 0);
        
        // Security settings
        $response->forcessl = isset($typeconfig->lti_forcessl) ? (int)$typeconfig->lti_forcessl : 
                              (isset($configarray['forcessl']) ? (int)$configarray['forcessl'] : 0);
        
        // Organization information
        $response->organizationid = $typeconfig->lti_organizationid ?? $configarray['organizationid'] ?? null;
        $response->organizationurl = $configarray['organizationurl'] ?? null;
        $response->organizationdescr = $configarray['organizationdescr'] ?? null;
        
        // Launch container settings (how tool is displayed)
        $response->launchcontainer = isset($typeconfig->lti_launchcontainer) ? (int)$typeconfig->lti_launchcontainer : 
                                     (isset($configarray['launchcontainer']) ? (int)$configarray['launchcontainer'] : null);
        
        // Debug settings
        $response->debuglaunch = isset($typeconfig->lti_debuglaunch) ? (int)$typeconfig->lti_debuglaunch : 
                                 (isset($configarray['debuglaunch']) ? (int)$configarray['debuglaunch'] : 0);
        
        // Icon URL
        $response->icon = $typeconfig->lti_icon ?? $configarray['icon'] ?? null;
        $response->secureicon = $typeconfig->lti_secureicon ?? $configarray['secureicon'] ?? null;
        
        // Tool proxy information (for LTI 2.0)
        $response->toolproxyid = $typeconfig->lti_toolproxyid ?? null;
        
        // Content item settings
        $response->contentitem = isset($typeconfig->lti_contentitem) ? (int)$typeconfig->lti_contentitem : 
                                 (isset($configarray['contentitem']) ? (int)$configarray['contentitem'] : 0);
        
        // Course visibility settings
        $response->coursevisible = isset($typeconfig->lti_coursevisible) ? (int)$typeconfig->lti_coursevisible : 
                                   (isset($configarray['coursevisible']) ? (int)$configarray['coursevisible'] : null);
        
        // Module introduction/description
        $response->intro = $configarray['intro'] ?? null;
        $response->introformat = isset($configarray['introformat']) ? (int)$configarray['introformat'] : null;
        
        // Additional LTI service configuration parameters
        // These are service-specific settings prefixed with 'ltiservice_'
        $ltiservices = [];
        foreach ($configarray as $key => $value) {
            if (strpos($key, 'ltiservice_') === 0) {
                $ltiservices[$key] = $value;
            }
        }
        if (!empty($ltiservices)) {
            $response->ltiservices = $ltiservices;
        }
        
        // Additional type-specific settings
        // Include any other configuration keys not explicitly mapped above
        $additionalconfig = [];
        $mappedkeys = [
            'typename', 'description', 'toolurl', 'securetoolurl', 'ltiversion', 'clientid',
            'resourcekey', 'password', 'customparameters', 'sendname', 'sendemailaddr',
            'acceptgrades', 'allowroster', 'forcessl', 'organizationid', 'organizationurl',
            'organizationdescr', 'launchcontainer', 'debuglaunch', 'icon', 'secureicon',
            'toolproxyid', 'contentitem', 'coursevisible', 'intro', 'introformat'
        ];
        
        foreach ($configarray as $key => $value) {
            // Skip lti_ prefixed keys as they're from lti_types table
            // Skip already mapped keys
            // Skip ltiservice_ keys (already handled above)
            if (strpos($key, 'lti_') !== 0 && 
                !in_array($key, $mappedkeys) && 
                strpos($key, 'ltiservice_') !== 0) {
                $additionalconfig[$key] = $value;
            }
        }
        if (!empty($additionalconfig)) {
            $response->additionalconfig = $additionalconfig;
        }
        
        // Include instance-specific information if available
        if ($instanceid) {
            $response->instanceid = $instanceid;
            
            // Get instance-specific settings that may override tool type defaults
            if (isset($ltiinstance)) {
                $response->instancename = $ltiinstance->name ?? null;
                $response->instructorcustomparameters = $ltiinstance->instructorcustomparameters ?? null;
                
                // Grade settings from instance
                if (isset($ltiinstance->grade)) {
                    $response->maxgrade = $ltiinstance->grade;
                }
                if (isset($ltiinstance->gradesync)) {
                    $response->gradesync = (int)$ltiinstance->gradesync;
                }
                
                // Instance-specific launch container
                if (isset($ltiinstance->launchcontainer)) {
                    $response->instancelaunchcontainer = (int)$ltiinstance->launchcontainer;
                }
                
                // Tool URL from instance (may differ from type default)
                if (isset($ltiinstance->toolurl)) {
                    $response->instancetoolurl = $ltiinstance->toolurl;
                }
                if (isset($ltiinstance->securetoolurl)) {
                    $response->instancesecuretoolurl = $ltiinstance->securetoolurl;
                }
                
                // Resource link ID
                if (isset($ltiinstance->resourcekey)) {
                    $response->instanceresourcekey = $canmanage ? $ltiinstance->resourcekey : '********';
                }
                if (isset($ltiinstance->password)) {
                    $response->instancepassword = $canmanage ? $ltiinstance->password : '********';
                }
            }
        }
        
        // Include capability information
        $response->capabilities = [
            'canview' => true, // Always true if we got this far
            'canmanage' => $canmanage
        ];
        
        // Return successful response with comprehensive configuration
        $this->success($response);
    }
    
    /**
     * Handle POST request - not supported for this endpoint.
     *
     * @return void Outputs error response
     */
    protected function handle_post() {
        $this->error(
            'METHOD_NOT_ALLOWED',
            'POST method not supported for LTI configuration endpoint',
            405,
            ['allowedMethods' => ['GET']]
        );
    }
    
    /**
     * Handle PUT request - not supported for this endpoint.
     *
     * @return void Outputs error response
     */
    protected function handle_put() {
        $this->error(
            'METHOD_NOT_ALLOWED',
            'PUT method not supported for LTI configuration endpoint',
            405,
            ['allowedMethods' => ['GET']]
        );
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint.
     *
     * @return void Outputs error response
     */
    protected function handle_delete() {
        $this->error(
            'METHOD_NOT_ALLOWED',
            'DELETE method not supported for LTI configuration endpoint',
            405,
            ['allowedMethods' => ['GET']]
        );
    }
}

// Instantiate and execute the endpoint
$endpoint = new LtiConfigEndpoint();
$endpoint->execute();
