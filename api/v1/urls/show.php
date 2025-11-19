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
 * REST API endpoint for URL activity detail retrieval.
 *
 * Implements GET /api/v1/urls/{id} endpoint that returns comprehensive
 * URL activity metadata including external URL, display settings, and
 * access information. This endpoint enables React frontend components to
 * display URL links with proper permissions enforcement and click tracking.
 *
 * Key features:
 * - JWT token authentication via ApiBase parent class
 * - Validates URL activity existence in database
 * - Enforces mod/url:view capability before returning data
 * - Retrieves URL configuration and metadata
 * - Formats URL for React rendering
 * - Returns structured JSON response for React consumption
 *
 * Endpoint: GET /api/v1/urls/{id}
 * Parameters:
 *   - id (int, required): URL instance ID from URL path
 *
 * Response structure:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "course": 5,
 *     "name": "Course Resources",
 *     "intro": "Introduction text...",
 *     "introformat": 1,
 *     "externalurl": "https://example.com/resource",
 *     "display": 0,
 *     "displayoptions": "a:2:{...}",
 *     "parameters": "a:1:{...}",
 *     "timemodified": 1637772000,
 *     "cm_id": 456,
 *     "course_module": {
 *       "id": 456,
 *       "visible": 1,
 *       "section": 1
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
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * API endpoint class for URL activity detail retrieval.
 *
 * Handles GET requests for individual URL activity data, enforcing
 * permission checks and formatting responses for React frontend consumption.
 *
 * @package    core_api
 * @subpackage api_v1_urls
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class UrlsShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request for URL activity details.
     *
     * Retrieves URL activity data including external URL, validates user permissions,
     * and returns formatted JSON response.
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
        
        // Get course module instance
        $cm = get_coursemodule_from_instance('url', $url->id, $url->course, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        
        // Enforce permission check
        require_capability('mod/url:view', $context);
        
        // Format intro text with pluginfile URLs
        $url->intro = file_rewrite_pluginfile_urls(
            $url->intro,
            'pluginfile.php',
            $context->id,
            'mod_url',
            'intro',
            null
        );
        
        // Add course module information
        $url->cm_id = $cm->id;
        $url->course_module = [
            'id' => $cm->id,
            'visible' => $cm->visible,
            'section' => $cm->section,
            'availability' => $cm->availability
        ];
        
        // Return formatted response
        $this->json_response([
            'id' => $url->id,
            'course' => $url->course,
            'name' => $url->name,
            'intro' => $url->intro,
            'introformat' => $url->introformat,
            'externalurl' => $url->externalurl,
            'display' => $url->display,
            'displayoptions' => $url->displayoptions,
            'parameters' => $url->parameters,
            'timemodified' => $url->timemodified,
            'cm_id' => $url->cm_id,
            'course_module' => $url->course_module
        ]);
    }
}

// Instantiate and execute the endpoint

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new api_v1_urls_show();
    $endpoint->execute();
}
