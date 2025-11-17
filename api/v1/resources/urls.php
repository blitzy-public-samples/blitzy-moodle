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
 * REST API endpoint for URL resource information retrieval.
 *
 * Implements GET /api/v1/resources/urls/{id} endpoint for retrieving URL resource
 * information including external link, display type, and presentation parameters.
 * Extends ApiBase for JWT authentication and error handling. Delegates to url_view()
 * for event tracking, url_get_full_url() for URL processing, and
 * url_get_final_display_type() for display mode determination.
 *
 * This endpoint enables React components to display external URL resources with
 * proper display modes (link, embedded iframe, popup window, new tab), tracking,
 * and validation. Enforces mod/url:view capability and validates external URLs.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Disable Moodle page setup and redirects in API mode
define('NO_MOODLE_COOKIES', true);

// Include Moodle configuration
require_once(__DIR__ . '/../../../config.php');

// Include API infrastructure
require_once($CFG->dirroot . '/api/lib/api_base.php');
require_once($CFG->dirroot . '/api/lib/api_exception.php');

// Include URL module functions
require_once($CFG->dirroot . '/mod/url/lib.php');
require_once($CFG->dirroot . '/mod/url/locallib.php');

/**
 * URL resource endpoint class for retrieving URL resource information.
 *
 * This endpoint provides comprehensive URL resource data including the external URL,
 * display configuration, and metadata. It wraps existing Moodle URL module functions
 * without duplicating business logic, following the thin wrapper pattern.
 *
 * Supported HTTP Methods:
 * - GET: Retrieve URL resource information by ID
 *
 * URL Parameters:
 * - id: URL resource instance ID (required, integer)
 *
 * Response Structure:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "name": "Example URL",
 *     "intro": "Description text",
 *     "introhtml": "<p>Formatted description</p>",
 *     "externalurl": "http://example.com",
 *     "fullurl": "http://example.com?userid=456",
 *     "display": 0,
 *     "displaytype": "open",
 *     "displayoptions": {...},
 *     "timemodified": 1234567890,
 *     "course": 5,
 *     "coursemodule": 67,
 *     "section": 2,
 *     "visible": 1,
 *     "parameters": {
 *       "width": 800,
 *       "height": 600
 *     }
 *   },
 *   "meta": null
 * }
 *
 * Error Responses:
 * - 401: Unauthorized (missing or invalid JWT token)
 * - 403: Forbidden (insufficient permissions)
 * - 404: Not Found (URL resource does not exist)
 * - 400: Bad Request (invalid URL resource data)
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class UrlResourceEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve URL resource information.
     *
     * Implements the complete URL resource retrieval workflow:
     * 1. Extracts and validates URL resource ID from request parameters
     * 2. Retrieves URL record from database with existence validation
     * 3. Loads associated course module with proper error handling
     * 4. Retrieves course record for context and permission checking
     * 5. Creates module context for capability enforcement
     * 6. Enforces mod/url:view capability with user authentication
     * 7. Validates external URL is not empty or malformed
     * 8. Triggers view event and updates completion tracking via url_view()
     * 9. Processes URL with dynamic parameter replacement via url_get_full_url()
     * 10. Determines display type via url_get_final_display_type()
     * 11. Parses display options from serialized configuration
     * 12. Formats intro text with proper HTML rendering
     * 13. Extracts URL metadata including protocol and domain
     * 14. Returns comprehensive JSON response with all URL data
     *
     * @return void Outputs JSON response directly via success() method
     * @throws NotFoundException If URL resource ID is invalid or does not exist
     * @throws ValidationException If external URL is empty or malformed
     * @throws ForbiddenException If user lacks mod/url:view capability
     * @throws UnauthorizedException If JWT authentication fails
     */
    protected function handle_get() {
        global $DB;
        
        // Extract URL resource ID from request parameters
        // Using PARAM_INT ensures type safety and prevents SQL injection
        $urlid = $this->getParam('id', PARAM_INT, true);
        
        // Retrieve URL record from database
        // MUST_EXIST flag throws exception if record not found
        $url = $DB->get_record('url', ['id' => $urlid], '*', MUST_EXIST);
        
        if (!$url) {
            throw new NotFoundException("URL resource not found", [
                'urlId' => $urlid,
                'reason' => 'No URL resource exists with the provided ID'
            ]);
        }
        
        // Get course module from URL instance
        // This links the URL activity to the course structure
        $cm = get_coursemodule_from_instance('url', $url->id, $url->course, false, MUST_EXIST);
        
        if (!$cm) {
            throw new NotFoundException("Course module not found for URL resource", [
                'urlId' => $url->id,
                'courseId' => $url->course,
                'reason' => 'Course module record is missing or corrupted'
            ]);
        }
        
        // Load course record for context and metadata
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        
        if (!$course) {
            throw new NotFoundException("Course not found", [
                'courseId' => $cm->course,
                'reason' => 'Course record does not exist'
            ]);
        }
        
        // Get module context for permission checking
        // Context is essential for capability enforcement
        $context = context_module::instance($cm->id);
        
        // Enforce viewing permission using Moodle's capability system
        // This delegates to existing permission checking logic
        // Throws ForbiddenException if user lacks mod/url:view capability
        $this->checkCapability('mod/url:view', $context);
        
        // Validate external URL exists and is not empty
        // Trim whitespace and check for empty string or default placeholder
        $externalUrl = trim($url->externalurl ?? '');
        
        // Check if URL is empty or just the default "http://" placeholder
        if (empty($externalUrl) || $externalUrl === 'http://' || $externalUrl === 'https://') {
            throw new ValidationException("Invalid or empty external URL", [
                'urlId' => $url->id,
                'externalUrl' => $externalUrl,
                'reason' => 'External URL is empty or contains only protocol placeholder'
            ]);
        }
        
        // Validate URL format (basic validation)
        if (!filter_var($externalUrl, FILTER_VALIDATE_URL)) {
            throw new ValidationException("Malformed external URL", [
                'urlId' => $url->id,
                'externalUrl' => $externalUrl,
                'reason' => 'External URL does not match valid URL format'
            ]);
        }
        
        // Trigger view event and update completion tracking
        // Delegates to existing url_view() function for proper event logging
        // This maintains consistency with PHP-rendered URL view behavior
        url_view($url, $course, $cm, $context);
        
        // Get full external URL with parameter processing
        // This function handles dynamic replacements like user ID, course ID, etc.
        // Examples: replacing {userid} with actual user ID
        $fullUrl = url_get_full_url($url, $cm, $course);
        
        // Determine final display type
        // Returns one of: RESOURCELIB_DISPLAY_OPEN, RESOURCELIB_DISPLAY_NEW,
        // RESOURCELIB_DISPLAY_EMBED, RESOURCELIB_DISPLAY_FRAME, RESOURCELIB_DISPLAY_POPUP
        $displayTypeConstant = url_get_final_display_type($url);
        
        // Convert display type constant to string for React frontend
        $displayTypeMap = [
            RESOURCELIB_DISPLAY_OPEN => 'open',           // Open in same window
            RESOURCELIB_DISPLAY_NEW => 'new',             // Open in new window/tab
            RESOURCELIB_DISPLAY_EMBED => 'embed',         // Embed in page
            RESOURCELIB_DISPLAY_FRAME => 'frame',         // Show in iframe
            RESOURCELIB_DISPLAY_POPUP => 'popup',         // Open in popup window
        ];
        
        $displayType = $displayTypeMap[$displayTypeConstant] ?? 'open';
        
        // Parse display options from serialized data
        // Display options contain popup dimensions, iframe settings, etc.
        $displayOptions = [];
        if (!empty($url->displayoptions)) {
            // Use unserialize_array() for safe deserialization
            // This prevents security issues from malformed serialized data
            $displayOptions = unserialize_array($url->displayoptions);
            
            // Ensure it's always an array
            if (!is_array($displayOptions)) {
                $displayOptions = [];
            }
        }
        
        // Format intro text with proper HTML rendering
        // This applies filters and formatting consistent with Moodle standards
        $introHtml = format_module_intro('url', $url, $cm->id);
        
        // Extract URL metadata for additional context
        $urlParts = parse_url($fullUrl);
        $protocol = $urlParts['scheme'] ?? '';
        $domain = $urlParts['host'] ?? '';
        
        // Build parameters object for popup/embed configuration
        $parameters = [];
        
        // Extract width and height if available (for popup/embed modes)
        if (isset($displayOptions['popupwidth'])) {
            $parameters['width'] = (int)$displayOptions['popupwidth'];
        }
        if (isset($displayOptions['popupheight'])) {
            $parameters['height'] = (int)$displayOptions['popupheight'];
        }
        
        // Extract print intro setting
        if (isset($displayOptions['printintro'])) {
            $parameters['printintro'] = (bool)$displayOptions['printintro'];
        }
        
        // Build comprehensive response data structure
        $responseData = [
            'id' => (int)$url->id,
            'name' => $url->name,
            'intro' => $url->intro ?? '',
            'introhtml' => $introHtml,
            'externalurl' => $url->externalurl,
            'fullurl' => $fullUrl,
            'display' => (int)$url->display,
            'displaytype' => $displayType,
            'displayoptions' => $displayOptions,
            'timemodified' => (int)$url->timemodified,
            'course' => (int)$url->course,
            'coursemodule' => (int)$cm->id,
            'section' => (int)$cm->section,
            'visible' => (int)$cm->visible,
            'parameters' => $parameters,
            'metadata' => [
                'protocol' => $protocol,
                'domain' => $domain,
            ],
        ];
        
        // Return success response with URL resource data
        // Uses ApiBase::success() helper which handles CORS and response formatting
        $this->success($responseData);
    }
    
    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * URL resource retrieval is a read-only operation, so POST is not allowed.
     * Override this method to throw MethodNotAllowedException.
     *
     * @return void
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException("POST method is not supported for URL resource retrieval", [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/resources/urls/{id}'
        ]);
    }
    
    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * URL resource retrieval is a read-only operation, so PUT is not allowed.
     * URL modification should use dedicated update endpoints.
     *
     * @return void
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException("PUT method is not supported for URL resource retrieval", [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/resources/urls/{id}'
        ]);
    }
    
    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * URL resource retrieval is a read-only operation, so DELETE is not allowed.
     * URL deletion should use dedicated admin endpoints with proper permissions.
     *
     * @return void
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException("DELETE method is not supported for URL resource retrieval", [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/resources/urls/{id}'
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new UrlResourceEndpoint();
$endpoint->execute();
