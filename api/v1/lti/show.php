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
 * REST API endpoint for retrieving LTI tool instance details.
 *
 * GET /api/v1/lti/{id}
 *
 * This endpoint provides comprehensive information about an LTI (Learning Tools
 * Interoperability) tool instance. It wraps existing Moodle LTI functions to
 * retrieve tool configuration, type settings, and launch parameters without
 * duplicating any business logic.
 *
 * The endpoint enforces mod/lti:view capability checking and returns detailed
 * information including:
 * - Basic instance information (id, name, intro, timestamps)
 * - Tool configuration (toolurl, launch container, icons)
 * - Type configuration (from lti_get_type_config)
 * - Launch settings and parameters
 * - User capabilities in the context
 * - Course module and course information
 *
 * Authentication: Requires valid JWT token in Authorization header
 * Authorization: Requires mod/lti:view capability in module context
 *
 * Response format: Standard API envelope with success/error structure
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
// In test environment, these are already loaded by PHPUnit bootstrap or test script
if (!defined('PHPUNIT_TEST') && !defined('API_TEST_MODE')) {
    require_once(__DIR__ . '/../../../config.php');
    require_once($CFG->dirroot . '/mod/lti/lib.php');
    require_once($CFG->dirroot . '/mod/lti/locallib.php');
}

// Load API utilities
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * LTI tool detail endpoint class.
 *
 * Handles GET requests to retrieve comprehensive LTI tool instance information.
 * Extends ApiBase to inherit JWT authentication, capability checking, parameter
 * extraction, and response formatting functionality.
 *
 * This endpoint follows the thin wrapper pattern - it calls existing Moodle
 * functions without reimplementing any business logic:
 * - lti_get_type_config() for tool type configuration
 * - lti_get_tool_by_url_match() for finding tool by URL when typeid is empty
 * - lti_get_launch_container() for launch container settings
 * - Standard Moodle database access via $DB for retrieving records
 * - require_capability() for permission enforcement
 */
class LtiShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve LTI tool instance details.
     *
     * This method implements the complete endpoint logic:
     * 1. Extract and validate LTI instance ID from request parameters
     * 2. Retrieve LTI instance record from database
     * 3. Get associated course module and course records
     * 4. Check mod/lti:view capability in the module context
     * 5. Retrieve tool type configuration using existing Moodle functions
     * 6. Build comprehensive response with tool details and user capabilities
     * 7. Return formatted JSON response via ApiBase::success()
     *
     * The method uses only existing Moodle core functions for all operations:
     * - $DB->get_record() for database queries
     * - get_coursemodule_from_instance() for course module retrieval
     * - context_module::instance() for context creation
     * - lti_get_type_config() for tool type configuration
     * - lti_get_tool_by_url_match() for tool URL matching
     * - lti_get_launch_container() for launch container settings
     * - has_capability() for user capability checks
     * - format_string() and format_text() for output formatting
     *
     * Error Handling:
     * - Missing LTI ID: Throws ValidationException via getParam()
     * - LTI not found: $DB->get_record() with MUST_EXIST throws exception
     * - Course module not found: get_coursemodule_from_instance() throws exception
     * - Permission denied: require_capability() throws moodle_exception
     * - All exceptions are caught by ApiBase::execute() and formatted as JSON errors
     *
     * @return void Outputs JSON response directly via $this->success()
     * @throws ValidationException If LTI ID parameter is invalid or missing
     * @throws NotFoundException If LTI instance, course module, or course not found
     * @throws ForbiddenException If user lacks mod/lti:view capability
     */
    protected function handle_get() {
        global $DB;
        
        // Extract LTI instance ID from request parameters
        // Uses ApiBase::getParam() with PARAM_INT validation
        // Throws ValidationException if parameter is missing or invalid
        $ltid = $this->getParam('id', PARAM_INT);
        
        // Retrieve LTI instance from database
        // MUST_EXIST flag ensures exception is thrown if record not found
        // This wraps Moodle's standard data access - no business logic duplication
        $lti = $DB->get_record('lti', ['id' => $ltid], '*', MUST_EXIST);
        
        // Get course module record for this LTI instance
        // Uses existing Moodle function to retrieve course module
        // Throws exception if course module not found
        $cm = get_coursemodule_from_instance('lti', $lti->id, $lti->course, false, MUST_EXIST);
        
        // Get course record
        // Required for course context and metadata in response
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        
        // Create module context for capability checking
        // Context defines the security boundary for this LTI instance
        $context = context_module::instance($cm->id);
        
        // Enforce capability check - user must have permission to view LTI tools
        // Uses ApiBase::checkCapability() which wraps require_capability()
        // Throws ForbiddenException if user lacks the required capability
        // This is the authoritative permission check - no logic duplication
        $this->checkCapability('mod/lti:view', $context);
        
        // Get tool type ID from instance or by URL matching
        // This follows the same pattern as public/mod/lti/view.php:72-74
        $typeid = $lti->typeid;
        
        // If no typeid is set, try to find matching tool by URL
        // Uses existing lti_get_tool_by_url_match() function (locallib.php:2406)
        // This function finds the best matching tool type based on URL comparison
        if (empty($typeid)) {
            $tool = lti_get_tool_by_url_match($lti->toolurl);
            if ($tool) {
                $typeid = $tool->id;
            }
        }
        
        // Get tool type configuration if typeid is available
        // Uses existing lti_get_type_config() function (locallib.php:2202)
        // This retrieves all configuration settings for the tool type
        // Returns array with keys: toolurl, icon, secureicon, and type-specific settings
        $toolconfig = [];
        $toolurl = $lti->toolurl;
        
        if ($typeid) {
            // Call existing Moodle function to get type configuration
            // This is a thin wrapper - no business logic duplication
            $toolconfig = lti_get_type_config($typeid);
            
            // Use configured tool URL if available, otherwise use instance URL
            // Follows the same logic as public/mod/lti/view.php:76-80
            if (!empty($toolconfig['toolurl'])) {
                $toolurl = $toolconfig['toolurl'];
            }
        }
        
        // Get launch container setting
        // Uses existing lti_get_launch_container() function from lib.php
        // Determines how the LTI tool should be displayed (embed, window, etc.)
        $launchcontainer = lti_get_launch_container($lti, $toolconfig);
        
        // Get LTI version from type configuration
        // Default to LTI 1.0, but check for version in type config
        $ltiversion = LTI_VERSION_1;
        if ($typeid) {
            // Check if there's a specific version configured for this type
            // Uses the 'lti_ltiversion' key from toolconfig array
            if (isset($toolconfig['lti_ltiversion'])) {
                $ltiversion = $toolconfig['lti_ltiversion'];
            }
        }
        
        // Build launch URL for this LTI instance
        // Creates a moodle_url object pointing to the launch endpoint
        $launchurl = new moodle_url('/mod/lti/launch.php', ['id' => $cm->id]);
        
        // Check user capabilities in this context
        // Uses existing has_capability() function to check multiple permissions
        // These capability checks inform the frontend about available actions
        $capabilities = [
            'can_view' => has_capability('mod/lti:view', $context),
            'can_launch' => has_capability('mod/lti:view', $context),
            'can_grade' => has_capability('mod/lti:grade', $context),
            'can_manage' => has_capability('mod/lti:manage', $context),
            'can_addinstance' => has_capability('mod/lti:addinstance', $context),
        ];
        
        // Build comprehensive response data
        // Includes all LTI instance properties, tool configuration,
        // user capabilities, course module details, and course information
        $data = [
            // Basic LTI instance properties
            'id' => (int)$lti->id,
            'course' => (int)$lti->course,
            'name' => format_string($lti->name),  // Format with filters
            'intro' => format_text($lti->intro, $lti->introformat, ['context' => $context]),
            'introformat' => (int)$lti->introformat,
            'timecreated' => (int)$lti->timecreated,
            'timemodified' => (int)$lti->timemodified,
            
            // Tool type and configuration
            'typeid' => $typeid ? (int)$typeid : null,
            'toolurl' => $toolurl,
            'securetoolurl' => $lti->securetoolurl ?? null,
            'ltiversion' => $ltiversion,
            
            // Instructor choice settings
            // These control what information can be sent to the tool
            'instructorchoicesendname' => !empty($lti->instructorchoicesendname),
            'instructorchoicesendemailaddr' => !empty($lti->instructorchoicesendemailaddr),
            'instructorchoiceallowroster' => !empty($lti->instructorchoiceallowroster),
            'instructorchoiceallowsetting' => !empty($lti->instructorchoiceallowsetting),
            'instructorcustomparameters' => $lti->instructorcustomparameters ?? null,
            'instructorchoiceacceptgrades' => !empty($lti->instructorchoiceacceptgrades),
            
            // Grading settings
            'grade' => (int)$lti->grade,
            
            // Launch settings
            'launchcontainer' => (int)$launchcontainer,
            'debuglaunch' => !empty($lti->debuglaunch),
            'showtitlelaunch' => !empty($lti->showtitlelaunch),
            'showdescriptionlaunch' => !empty($lti->showdescriptionlaunch),
            
            // Authentication settings (password is never exposed)
            'resourcekey' => $lti->resourcekey ?? null,
            'password' => null,  // Security: never expose password in API response
            
            // Visual settings
            'icon' => $lti->icon ?? null,
            'secureicon' => $lti->secureicon ?? null,
            
            // Launch URL for the tool
            'launchurl' => $launchurl->out(false),
            
            // User capabilities in this context
            'capabilities' => $capabilities,
            
            // Tool configuration from type settings
            // Includes additional configuration options from lti_get_type_config()
            'toolconfig' => $toolconfig,
            
            // Course module information
            'coursemodule' => [
                'id' => (int)$cm->id,
                'course' => (int)$cm->course,
                'module' => (int)$cm->module,
                'instance' => (int)$cm->instance,
                'section' => (int)$cm->section,
                'visible' => (bool)$cm->visible,
                'groupmode' => (int)$cm->groupmode,
                'groupingid' => (int)$cm->groupingid,
            ],
            
            // Course information
            'course_info' => [
                'id' => (int)$course->id,
                'fullname' => format_string($course->fullname),
                'shortname' => format_string($course->shortname),
                'idnumber' => $course->idnumber ?? '',
                'category' => (int)$course->category,
            ],
        ];
        
        // Return success response with tool data
        // Uses ApiBase::success() to format and output JSON response
        // Sets appropriate CORS headers and HTTP status code (200)
        $this->success($data);
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * LTI tool details are read-only via GET requests. POST requests
     * should be rejected with Method Not Allowed error.
     *
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for this endpoint', [
            'endpoint' => '/api/v1/lti/{id}',
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * LTI tool details are read-only via GET requests. PUT requests
     * should be rejected with Method Not Allowed error.
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for this endpoint', [
            'endpoint' => '/api/v1/lti/{id}',
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * LTI tool deletion is not handled by this endpoint. DELETE requests
     * should be rejected with Method Not Allowed error.
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for this endpoint', [
            'endpoint' => '/api/v1/lti/{id}',
            'allowedMethods' => ['GET']
        ]);
    }
}

// Instantiate and execute the endpoint
// This is the entry point when the PHP script is accessed directly
// The ApiBase::execute() method handles:
// - JWT token validation
// - HTTP method routing
// - Exception handling
// - Response formatting
// - CORS headers
// Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new LtiShowEndpoint();
    $endpoint->execute();
}
