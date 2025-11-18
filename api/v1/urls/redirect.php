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
 * REST API endpoint for URL activity redirect URL generation.
 *
 * Implements GET /api/v1/urls/{id}/redirect endpoint that returns the
 * properly formatted external URL with any configured parameters applied.
 * This endpoint enables React frontend to obtain the correct redirect URL
 * while enforcing permissions and tracking usage.
 *
 * Key features:
 * - JWT token authentication via ApiBase parent class
 * - Validates URL activity existence in database
 * - Enforces mod/url:view capability before returning URL
 * - Processes URL parameters and substitutions
 * - Returns sanitized external URL ready for redirect
 * - Supports parameter substitution (userid, courseid, etc.)
 *
 * Endpoint: GET /api/v1/urls/{id}/redirect
 * Parameters:
 *   - id (int, required): URL instance ID from URL path
 *
 * Response structure:
 * {
 *   "success": true,
 *   "data": {
 *     "redirect_url": "https://example.com/resource?user=123",
 *     "parameters": {
 *       "user": "123",
 *       "course": "5"
 *     }
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

require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/filelib.php');
require_once($CFG->dirroot . '/mod/url/lib.php');
require_once($CFG->dirroot . '/mod/url/locallib.php');
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * API endpoint class for URL redirect generation.
 *
 * Handles GET requests for URL redirect URL generation, enforcing
 * permission checks and formatting responses for React frontend consumption.
 *
 * @package    core_api
 * @subpackage api_v1_urls
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class api_v1_urls_redirect extends ApiBase {
    
    /**
     * Handle GET request for redirect URL.
     *
     * Retrieves and processes the external URL with parameters applied.
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
        
        // Get the full redirect URL using existing Moodle function
        $fullurl = url_get_full_url($url, $cm, $course);
        
        // Parse any parameters that were applied
        $applied_parameters = [];
        if (!empty($url->parameters)) {
            $parameters = unserialize_array($url->parameters);
            if (is_array($parameters)) {
                foreach ($parameters as $key => $value) {
                    // Replace parameter variables with actual values
                    $applied_value = $value;
                    $applied_value = str_replace('{userid}', $USER->id, $applied_value);
                    $applied_value = str_replace('{courseid}', $course->id, $applied_value);
                    $applied_value = str_replace('{coursename}', $course->fullname, $applied_value);
                    $applied_value = str_replace('{username}', $USER->username, $applied_value);
                    
                    $applied_parameters[$key] = $applied_value;
                }
            }
        }
        
        // Return formatted response
        $this->json_response([
            'redirect_url' => $fullurl,
            'parameters' => $applied_parameters
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new api_v1_urls_redirect();
$endpoint->execute();
