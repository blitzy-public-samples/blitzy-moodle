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
 * REST API endpoint for URL activity parameters retrieval.
 *
 * Implements GET /api/v1/urls/{id}/parameters endpoint that returns the
 * configured URL parameters and their values. This endpoint enables React
 * frontend to display parameter configuration and preview how variables
 * will be substituted when the URL is accessed.
 *
 * Key features:
 * - JWT token authentication via ApiBase parent class
 * - Validates URL activity existence in database
 * - Enforces mod/url:view capability before returning parameters
 * - Parses serialized parameter data
 * - Shows variable substitution preview (userid, courseid, etc.)
 * - Returns structured parameter information
 *
 * Endpoint: GET /api/v1/urls/{id}/parameters
 * Parameters:
 *   - id (int, required): URL instance ID from URL path
 *
 * Response structure:
 * {
 *   "success": true,
 *   "data": {
 *     "parameters": [
 *       {
 *         "name": "user",
 *         "value": "{userid}",
 *         "resolved_value": "123"
 *       },
 *       {
 *         "name": "course",
 *         "value": "{courseid}",
 *         "resolved_value": "5"
 *       }
 *     ],
 *     "available_variables": [
 *       "{userid}",
 *       "{username}",
 *       "{courseid}",
 *       "{coursename}"
 *     ]
 *   }
 * }
 *
 * Error responses:
 * - 404: URL activity not found
 * - 403: Permission denied (missing mod/url:view capability)
 * - 401: Unauthorized (invalid JWT token)
 *
 * @package    core_api
 * @subpackage api_v1_urls
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Only require config if not already loaded (for test compatibility)
if (!defined('MOODLE_INTERNAL')) {
    require_once(__DIR__ . '/../../../config.php');
}
require_once($CFG->dirroot . '/lib/filelib.php');
require_once($CFG->dirroot . '/mod/url/lib.php');
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * API endpoint class for URL parameters retrieval.
 *
 * Handles GET requests for URL parameter information, enforcing
 * permission checks and formatting responses for React frontend consumption.
 *
 * @package    core_api
 * @subpackage api_v1_urls
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class UrlsParametersEndpoint extends ApiBase {
    
    /**
     * Handle GET request for URL parameters.
     *
     * Retrieves URL parameter configuration and shows how variables
     * will be resolved for the current user and course context.
     *
     * @return void Outputs JSON response directly
     * @throws moodle_exception If URL activity not found or permission denied
     */
    protected function handle_get() {
        global $DB, $USER;
        
        // Get URL ID from URL path
        $urlid = required_param('id', PARAM_INT);
        
        // Get URL record from database
        $url = $DB->get_record('url', array('id' => $urlid), '*', MUST_EXIST);
        
        // Get course and course module
        $course = $DB->get_record('course', array('id' => $url->course), '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('url', $url->id, $url->course, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        
        // Enforce permission check
        require_capability('mod/url:view', $context);
        
        // Parse URL parameters
        $parameters = [];
        if (!empty($url->parameters)) {
            $params = unserialize_array($url->parameters);
            if (is_array($params)) {
                foreach ($params as $name => $value) {
                    // Resolve variables to show what they'll become
                    $resolved = $value;
                    $resolved = str_replace('{userid}', (string)$USER->id, $resolved);
                    $resolved = str_replace('{username}', $USER->username, $resolved);
                    $resolved = str_replace('{courseid}', (string)$course->id, $resolved);
                    $resolved = str_replace('{coursename}', $course->fullname, $resolved);
                    
                    $parameters[] = [
                        'name' => $name,
                        'value' => $value,
                        'resolved_value' => $resolved
                    ];
                }
            }
        }
        
        // List of available variable substitutions
        $available_variables = [
            '{userid}',
            '{username}',
            '{courseid}',
            '{coursename}'
        ];
        
        // Return formatted response
        $this->json_response([
            'parameters' => $parameters,
            'available_variables' => $available_variables,
            'context' => [
                'userid' => $USER->id,
                'username' => $USER->username,
                'courseid' => $course->id,
                'coursename' => $course->fullname
            ]
        ]);
    }
    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for URL parameters');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for URL parameters');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for URL parameters');
    }
}

// Instantiate and execute the endpoint

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new api_v1_urls_parameters();
    $endpoint->execute();
}
