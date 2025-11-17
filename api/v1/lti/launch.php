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
 * LTI Launch API Endpoint
 *
 * REST API endpoint for generating OAuth-signed LTI launch requests.
 * Generates launch URL with all required LTI parameters for external
 * tool integration by wrapping existing Moodle LTI launch functions.
 *
 * Endpoint: POST /api/v1/lti/{id}/launch
 *
 * Request Parameters:
 * - id (path): LTI activity instance ID
 * - action (optional): Launch action type for grade report launches
 * - foruserid (optional): User ID to launch as (requires gradereport/grader:view)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "launch_url": "https://tool.example.com/launch",
 *     "launch_parameters": {
 *       "oauth_consumer_key": "...",
 *       "oauth_signature": "...",
 *       "user_id": "...",
 *       ...
 *     },
 *     "method": "POST",
 *     "lti_version": "LTI-1p0"
 *   }
 * }
 *
 * This endpoint wraps the following existing Moodle functions:
 * - lti_get_type_config(): Retrieves LTI tool configuration
 * - lti_get_launch_data(): Generates OAuth-signed launch parameters (LTI 1.1/2.0)
 * - lti_initiate_login(): Initiates OpenID Connect login flow (LTI 1.3)
 *
 * No business logic is duplicated - all LTI parameter generation,
 * OAuth signing, and configuration retrieval uses existing Moodle functions.
 *
 * @package    api
 * @subpackage lti
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
// In test environment, these are already loaded by PHPUnit bootstrap or test script
if (!defined('PHPUNIT_TEST') && !defined('API_TEST_MODE')) {
    require_once(__DIR__ . '/../../../config.php');
    require_once($CFG->dirroot . '/mod/lti/lib.php');
    require_once($CFG->dirroot . '/mod/lti/locallib.php');
}

require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * LTI Launch Endpoint
 *
 * Handles POST requests to generate LTI launch URLs with OAuth-signed
 * parameters. Supports both LTI 1.1/2.0 (OAuth 1.0a) and LTI 1.3
 * (OpenID Connect) authentication flows.
 *
 * Security:
 * - Requires valid JWT authentication token
 * - Enforces mod/lti:view capability in course module context
 * - Validates launch as different user requires gradereport/grader:view
 * - All parameter validation through Moodle's PARAM_* functions
 *
 * @package api
 */
class LtiLaunchEndpoint extends ApiBase {
    
    /**
     * Handle GET requests.
     *
     * GET is not supported for LTI launch generation. Launch data must be
     * requested via POST to ensure parameters are not logged in server logs
     * and to support potential future CSRF protection.
     *
     * @throws MethodNotAllowedException Always throws - GET not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException(
            'GET method not supported for LTI launch generation',
            ['allowed_methods' => ['POST']]
        );
    }
    
    /**
     * Handle POST requests to generate LTI launch data.
     *
     * Generates OAuth-signed LTI launch parameters by calling existing
     * Moodle LTI functions. Supports both LTI 1.1/2.0 and LTI 1.3.
     *
     * Request Parameters:
     * - id: LTI activity instance ID (from URL path)
     * - action: Optional launch action (e.g., 'gradeReport')
     * - foruserid: Optional user ID to launch as (requires grader capability)
     *
     * Response includes:
     * - launch_url: The tool's launch endpoint URL
     * - launch_parameters: All OAuth-signed parameters for the POST request
     * - method: HTTP method to use (always 'POST')
     * - lti_version: LTI version being used
     *
     * @throws UnauthorizedException If user is not authenticated
     * @throws ForbiddenException If user lacks required capability
     * @throws NotFoundException If LTI instance not found
     * @throws ValidationException If parameters are invalid
     */
    protected function handle_post() {
        global $DB, $CFG, $COURSE;
        
        // Get authenticated user (throws UnauthorizedException if not authenticated)
        $user = $this->getUser();
        
        // Extract LTI instance ID from request
        // ID comes from URL path: /api/v1/lti/{id}/launch
        $instanceid = $this->getParam('id', PARAM_INT);
        
        // Get optional parameters
        $action = $this->getParam('action', PARAM_ALPHANUMEXT, false, '');
        $foruserid = $this->getParam('foruserid', PARAM_INT, false, 0);
        
        // Retrieve LTI activity instance from database
        $lti = $DB->get_record('lti', ['id' => $instanceid], '*', MUST_EXIST);
        
        if (!$lti) {
            throw new NotFoundException('LTI activity not found', [
                'instanceId' => $instanceid,
                'reason' => 'The specified LTI activity does not exist'
            ]);
        }
        
        // Get course module for context
        $cm = get_coursemodule_from_instance('lti', $lti->id, $lti->course, false, MUST_EXIST);
        
        if (!$cm) {
            throw new NotFoundException('Course module not found for LTI activity', [
                'instanceId' => $instanceid,
                'courseId' => $lti->course,
                'reason' => 'Course module record is missing'
            ]);
        }
        
        // Get module context for capability checking
        $context = context_module::instance($cm->id);
        
        // Enforce mod/lti:view capability
        // This ensures user has permission to launch this LTI tool
        $this->checkCapability('mod/lti:view', $context);
        
        // If launching as different user, check grader capability
        if ($foruserid && $foruserid != $user->id) {
            $coursecontext = context_course::instance($lti->course);
            $this->checkCapability('gradereport/grader:view', $coursecontext);
            
            // Validate the target user exists
            $targetuser = $DB->get_record('user', ['id' => $foruserid], '*', MUST_EXIST);
            
            if (!$targetuser) {
                throw new ValidationException('Target user not found', [
                    'foruserid' => $foruserid,
                    'reason' => 'The specified user ID does not exist'
                ]);
            }
            
            // Set the launch user ID
            $launchuserid = $foruserid;
        } else {
            // Launch as the authenticated user
            $launchuserid = $user->id;
        }
        
        // Set course context for Moodle functions
        $COURSE = $DB->get_record('course', ['id' => $lti->course], '*', MUST_EXIST);
        
        // Get LTI tool type configuration
        // This retrieves the tool settings including LTI version, OAuth credentials, etc.
        $typeconfig = lti_get_type_config($lti->typeid);
        
        if (!$typeconfig) {
            throw new ValidationException('LTI tool configuration not found', [
                'typeId' => $lti->typeid,
                'reason' => 'Tool type configuration is missing or invalid'
            ]);
        }
        
        // Determine LTI version from configuration
        $ltiversion = $typeconfig['ltiversion'] ?? LTI_VERSION_1;
        
        // Determine message type based on action parameter
        // Default to basic-lti-launch-request for standard launches
        $messagetype = 'basic-lti-launch-request';
        
        if ($action === 'gradeReport') {
            // For grade report launches, use submission review request message type
            $messagetype = 'LtiSubmissionReviewRequest';
        }
        
        // Handle LTI 1.3 separately (uses OpenID Connect instead of OAuth 1.0a)
        if ($ltiversion === LTI_VERSION_1P3) {
            // LTI 1.3 uses OpenID Connect login flow
            // lti_initiate_login() returns the login URL to redirect the user to
            
            try {
                // Generate login initiation URL
                // This function handles all OIDC parameter generation
                $loginurl = lti_initiate_login($lti->course, $cm->id, $lti, $typeconfig, $messagetype, $launchuserid);
                
                if (!$loginurl) {
                    throw new Exception('Failed to generate LTI 1.3 login URL');
                }
                
                // For LTI 1.3, the client needs to redirect the user to the login URL
                // No POST parameters needed - it's a GET redirect
                $this->success([
                    'launch_url' => $loginurl,
                    'launch_parameters' => [],
                    'method' => 'GET',
                    'lti_version' => $ltiversion,
                    'message_type' => $messagetype,
                    'redirect_required' => true,
                    'info' => 'LTI 1.3 requires browser redirect to login URL'
                ]);
                
            } catch (Exception $e) {
                throw new ApiException(
                    'LTI_1_3_LAUNCH_FAILED',
                    'Failed to initiate LTI 1.3 login: ' . $e->getMessage(),
                    500,
                    [
                        'ltiVersion' => $ltiversion,
                        'errorDetails' => $e->getMessage()
                    ]
                );
            }
            
            return;
        }
        
        // For LTI 1.1/2.0, generate OAuth-signed launch parameters
        
        // Generate a nonce for this launch request
        // Nonce prevents replay attacks in OAuth 1.0a
        $nonce = uniqid('lti_launch_', true);
        
        try {
            // Call existing Moodle function to generate launch data
            // This function handles:
            // - Building all LTI standard parameters
            // - Adding custom parameters from tool configuration
            // - OAuth 1.0a signature generation
            // - User context information
            // Returns: [$endpoint, $parms] array
            list($endpoint, $parms) = lti_get_launch_data($lti, $nonce, $messagetype, $launchuserid);
            
            if (!$endpoint) {
                throw new Exception('Launch endpoint URL not returned from lti_get_launch_data');
            }
            
            if (!is_array($parms)) {
                throw new Exception('Launch parameters not returned as array from lti_get_launch_data');
            }
            
            // Successful launch data generation
            // Return JSON response with launch URL and signed parameters
            $this->success([
                'launch_url' => $endpoint,
                'launch_parameters' => $parms,
                'method' => 'POST',
                'lti_version' => $ltiversion,
                'message_type' => $messagetype,
                'oauth_signature_method' => $parms['oauth_signature_method'] ?? 'HMAC-SHA1',
                'info' => 'POST these parameters to launch_url to initiate LTI session'
            ]);
            
        } catch (Exception $e) {
            // Handle errors from lti_get_launch_data()
            throw new ApiException(
                'LTI_LAUNCH_DATA_GENERATION_FAILED',
                'Failed to generate LTI launch data: ' . $e->getMessage(),
                500,
                [
                    'instanceId' => $instanceid,
                    'ltiVersion' => $ltiversion,
                    'messageType' => $messagetype,
                    'errorDetails' => $e->getMessage()
                ]
            );
        }
    }
    
    /**
     * Handle PUT requests.
     *
     * PUT is not supported for LTI launch generation. Launch data is
     * generated fresh on each request and not updated.
     *
     * @throws MethodNotAllowedException Always throws - PUT not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException(
            'PUT method not supported for LTI launch generation',
            ['allowed_methods' => ['POST']]
        );
    }
    
    /**
     * Handle DELETE requests.
     *
     * DELETE is not supported for LTI launch generation. Launch sessions
     * are managed by the external tool, not by Moodle.
     *
     * @throws MethodNotAllowedException Always throws - DELETE not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(
            'DELETE method not supported for LTI launch generation',
            ['allowed_methods' => ['POST']]
        );
    }
}

// Instantiate and execute the endpoint
// Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new LtiLaunchEndpoint();
    $endpoint->execute();
}
