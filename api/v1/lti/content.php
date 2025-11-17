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
 * LTI Content-Item Selection REST API Endpoint
 *
 * Initiates deep linking workflow for selecting external tool content items to
 * embed in Moodle courses. This endpoint wraps the existing Moodle LTI content
 * item selection functionality, generating an OAuth-signed or LTI 1.3 launch
 * request for content selection.
 *
 * Endpoint: GET /api/v1/lti/{id}/content
 *
 * This endpoint:
 * - Validates JWT authentication and extracts the authenticated user
 * - Enforces moodle/course:manageactivities capability in course context
 * - Enforces mod/lti:addcoursetool capability to ensure user can add LTI tools
 * - Retrieves tool type configuration to determine LTI version (1.1 or 1.3)
 * - Handles LTI 1.3 initiate login flow if applicable
 * - Constructs return URL for tool to send selected content items back
 * - Calls lti_build_content_item_selection_request() to generate launch request
 * - Returns JSON with launch URL, parameters, and return URL
 *
 * Request Parameters:
 * - id (path): LTI tool type ID (required)
 * - courseid: Course ID where content will be added (required)
 * - title: Title for content selection context (optional)
 * - text: Descriptive text for selection context (optional)
 * - media_types: Comma-separated list of accepted media types (optional)
 *   Default: 'application/vnd.ims.lti.v1.ltilink'
 *   Example: 'application/vnd.ims.lti.v1.ltilink,image/*,text/html'
 * - presentation_targets: Comma-separated list of presentation targets (optional)
 *   Default: 'frame,iframe,window'
 *   Options: frame, iframe, window, embed
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "launch_url": "https://tool.example.com/content-item",
 *     "launch_parameters": {
 *       "lti_message_type": "ContentItemSelectionRequest",
 *       "lti_version": "LTI-1p0",
 *       "oauth_consumer_key": "key123",
 *       "oauth_signature": "...",
 *       "content_item_return_url": "https://moodle.example.com/api/v1/lti/content-return",
 *       ...
 *     },
 *     "return_url": "https://moodle.example.com/api/v1/lti/content-return",
 *     "lti_version": "LTI-1p0"
 *   }
 * }
 *
 * Error Responses:
 * - 401: Invalid or missing JWT token
 * - 403: User lacks required capabilities
 * - 404: LTI tool type not found
 * - 400: Missing or invalid parameters
 * - 500: Error generating launch request
 *
 * @package    api
 * @subpackage lti
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

// Load API base class
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * LTI Content-Item Selection Endpoint
 *
 * Handles GET requests to initiate LTI deep linking (content-item selection)
 * workflow. Generates OAuth-signed or LTI 1.3 launch request for external
 * tool to present content selection interface.
 */
class LtiContentEndpoint extends ApiBase {
    
    /**
     * Handle GET request for content-item selection.
     *
     * Initiates the LTI deep linking workflow by generating a launch request
     * with ContentItemSelectionRequest message type. The external tool will
     * present a content selection interface, and selected items will be sent
     * back to the return URL.
     *
     * Process:
     * 1. Validate and extract request parameters
     * 2. Verify course exists and user has permissions
     * 3. Retrieve LTI tool configuration
     * 4. Handle LTI 1.3 initiate login if applicable
     * 5. Construct return URL for content item response
     * 6. Build content item selection request with OAuth signature
     * 7. Return launch parameters for POST form submission
     *
     * @return void Outputs JSON response directly
     * @throws ValidationException If parameters are invalid
     * @throws ForbiddenException If user lacks required capabilities
     * @throws NotFoundException If tool or course not found
     * @throws ServerException If launch request generation fails
     */
    protected function handle_get() {
        global $DB, $CFG, $SESSION;
        
        // Get authenticated user from JWT token
        $user = $this->getUser();
        
        // Extract LTI tool type ID from URL path
        // URL pattern: /api/v1/lti/{id}/content
        $pathParts = explode('/', trim($this->requestUri, '/'));
        $idIndex = array_search('lti', $pathParts);
        
        if ($idIndex === false || !isset($pathParts[$idIndex + 1])) {
            throw new ValidationException('LTI tool type ID not found in URL', [
                'urlPattern' => '/api/v1/lti/{id}/content',
                'receivedUri' => $this->requestUri,
                'reason' => 'Tool type ID must be provided in URL path'
            ]);
        }
        
        $typeid = intval($pathParts[$idIndex + 1]);
        
        if ($typeid <= 0) {
            throw new ValidationException('Invalid LTI tool type ID', [
                'receivedId' => $pathParts[$idIndex + 1],
                'reason' => 'Tool type ID must be a positive integer'
            ]);
        }
        
        // Get required course ID parameter
        $courseid = $this->getParam('courseid', PARAM_INT, true);
        
        // Get optional content selection context parameters
        $title = $this->getParam('title', PARAM_TEXT, false, '');
        $text = $this->getParam('text', PARAM_RAW, false, '');
        
        // Get optional media types parameter (comma-separated string)
        $mediaTypesParam = $this->getParam('media_types', PARAM_TEXT, false, '');
        $mediatypes = [];
        if (!empty($mediaTypesParam)) {
            $mediatypes = array_map('trim', explode(',', $mediaTypesParam));
        }
        
        // Get optional presentation targets parameter (comma-separated string)
        $presentationTargetsParam = $this->getParam('presentation_targets', PARAM_TEXT, false, '');
        $presentationtargets = [];
        if (!empty($presentationTargetsParam)) {
            $presentationtargets = array_map('trim', explode(',', $presentationTargetsParam));
        }
        
        // Verify course exists
        $course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);
        
        if (!$course) {
            throw new NotFoundException('Course not found', [
                'courseId' => $courseid,
                'reason' => 'The specified course does not exist'
            ]);
        }
        
        // Get course context for capability checks
        $context = context_course::instance($courseid);
        
        // Enforce capability: moodle/course:manageactivities
        // User must be able to manage activities in the course
        $this->checkCapability('moodle/course:manageactivities', $context);
        
        // Enforce capability: mod/lti:addcoursetool
        // User must be able to add LTI tools to courses
        $this->checkCapability('mod/lti:addcoursetool', $context);
        
        // Get tool type configuration to check LTI version
        try {
            $config = lti_get_type_type_config($typeid);
        } catch (Exception $e) {
            throw new NotFoundException('LTI tool type not found', [
                'typeId' => $typeid,
                'reason' => 'Tool type configuration could not be retrieved',
                'originalError' => $e->getMessage()
            ]);
        }
        
        if (!$config) {
            throw new NotFoundException('LTI tool type not found', [
                'typeId' => $typeid,
                'reason' => 'Tool type configuration is empty or invalid'
            ]);
        }
        
        // Handle LTI 1.3 initiate login flow if applicable
        // LTI 1.3 requires an initial OIDC authentication flow
        if ($config->lti_ltiversion === LTI_VERSION_1P3) {
            // Check if we're in the middle of the initiate login flow
            if (!isset($SESSION->lti_initiatelogin_status)) {
                // Start initiate login flow
                // This will redirect to the tool's login initiation endpoint
                try {
                    $loginHtml = lti_initiate_login(
                        $courseid,
                        0, // cmid (0 for content selection)
                        null, // instance (null for content selection)
                        $config,
                        'ContentItemSelectionRequest',
                        $title,
                        $text
                    );
                    
                    // For API response, we return the login URL instead of rendering HTML
                    // Extract the form action URL from the HTML
                    if (preg_match('/<form[^>]+action=["\']([^"\']+)["\']/', $loginHtml, $matches)) {
                        $loginUrl = $matches[1];
                        
                        // Extract form parameters
                        preg_match_all('/<input[^>]+name=["\']([^"\']+)["\'][^>]+value=["\']([^"\']*)["\']/', $loginHtml, $paramMatches, PREG_SET_ORDER);
                        
                        $loginParams = [];
                        foreach ($paramMatches as $match) {
                            $loginParams[$match[1]] = $match[2];
                        }
                        
                        // Return login initiation data
                        $this->success([
                            'lti_version' => '1.3.0',
                            'initiate_login_url' => $loginUrl,
                            'initiate_login_parameters' => $loginParams,
                            'message' => 'LTI 1.3 initiate login required',
                            'instruction' => 'Client must POST to initiate_login_url with provided parameters'
                        ]);
                        return;
                        
                    } else {
                        throw new ServerException('Failed to parse LTI 1.3 login form', [
                            'reason' => 'Could not extract login URL from generated HTML'
                        ]);
                    }
                    
                } catch (Exception $e) {
                    throw new ServerException('Failed to initiate LTI 1.3 login', [
                        'typeId' => $typeid,
                        'courseId' => $courseid,
                        'originalError' => $e->getMessage()
                    ]);
                }
            } else {
                // Clear the login status flag
                unset($SESSION->lti_initiatelogin_status);
            }
        }
        
        // Construct return URL where tool will send selected content items
        // This should point to the content item return processing endpoint
        $returnurlparams = [
            'course' => $course->id,
            'id' => $typeid,
            'sesskey' => sesskey()
        ];
        
        // Use Moodle's content item return page
        // For API integration, this could be an API endpoint instead
        $returnurl = new moodle_url('/mod/lti/contentitem_return.php', $returnurlparams);
        
        // Build content item selection request
        // This calls the existing Moodle function that:
        // - Retrieves tool configuration
        // - Builds base LTI launch parameters
        // - Adds content-item selection specific parameters
        // - Signs the request with OAuth (LTI 1.1) or JWT (LTI 1.3)
        try {
            $request = lti_build_content_item_selection_request(
                $typeid,
                $course,
                $returnurl,
                $title,
                $text,
                $mediatypes,
                $presentationtargets
            );
            
        } catch (moodle_exception $e) {
            throw new ServerException('Failed to build content item selection request', [
                'typeId' => $typeid,
                'courseId' => $courseid,
                'errorCode' => $e->errorcode,
                'originalError' => $e->getMessage()
            ]);
            
        } catch (Exception $e) {
            throw new ServerException('Unexpected error building content item selection request', [
                'typeId' => $typeid,
                'courseId' => $courseid,
                'originalError' => $e->getMessage()
            ]);
        }
        
        // Validate the request object
        if (!$request || !isset($request->url) || !isset($request->params)) {
            throw new ServerException('Invalid content item selection request generated', [
                'reason' => 'Request object is missing required url or params properties'
            ]);
        }
        
        // Prepare response data
        $responseData = [
            'launch_url' => $request->url,
            'launch_parameters' => $request->params,
            'return_url' => $returnurl->out(false),
            'lti_version' => $config->lti_ltiversion ?? 'LTI-1p0',
            'tool_type_id' => $typeid,
            'course_id' => $courseid,
        ];
        
        // Add context information if title or text were provided
        if (!empty($title)) {
            $responseData['context_title'] = $title;
        }
        if (!empty($text)) {
            $responseData['context_text'] = $text;
        }
        
        // Add media types if specified
        if (!empty($mediatypes)) {
            $responseData['accepted_media_types'] = $mediatypes;
        }
        
        // Add presentation targets if specified
        if (!empty($presentationtargets)) {
            $responseData['accepted_presentation_targets'] = $presentationtargets;
        }
        
        // Add usage instructions
        $responseData['usage'] = [
            'instruction' => 'Client should POST launch_parameters to launch_url in a form',
            'method' => 'POST',
            'target' => 'Recommended: new window or iframe',
            'return_handling' => 'Tool will POST selected content items to return_url'
        ];
        
        // Return success response with launch data
        $this->success($responseData);
    }
    
    /**
     * Handle POST request - not supported.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for this endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/lti/{id}/content'
        ]);
    }
    
    /**
     * Handle PUT request - not supported.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for this endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/lti/{id}/content'
        ]);
    }
    
    /**
     * Handle DELETE request - not supported.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for this endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/lti/{id}/content'
        ]);
    }
}

// Instantiate and execute the endpoint
// ApiBase execute() method handles all exceptions internally
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new LtiContentEndpoint();
    $endpoint->execute();
}
