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
 * REST API endpoint for page activity detail retrieval.
 *
 * Implements GET /api/v1/pages/{id} endpoint that returns comprehensive
 * page activity metadata including HTML content, display settings, and
 * access information. This endpoint enables React frontend components to
 * display HTML pages with proper permissions enforcement and completion tracking.
 *
 * Key features:
 * - JWT token authentication via ApiBase parent class
 * - Validates page existence in database
 * - Enforces mod/page:view capability before returning data
 * - Retrieves page content and metadata
 * - Formats content for React rendering
 * - Returns structured JSON response for React consumption
 *
 * Endpoint: GET /api/v1/pages/{id}
 * Parameters:
 *   - id (int, required): Page instance ID from URL path
 *
 * Response structure:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "course": 5,
 *     "name": "Course Introduction",
 *     "intro": "Introduction text...",
 *     "introformat": 1,
 *     "content": "<p>HTML content...</p>",
 *     "contentformat": 1,
 *     "legacyfiles": 0,
 *     "legacyfileslast": null,
 *     "display": 5,
 *     "displayoptions": "a:3:{...}",
 *     "revision": 1,
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
 * - 404: Page not found
 * - 403: Permission denied (missing mod/page:view capability)
 * - 401: Unauthorized (invalid JWT token)
 *
 * @package    core_api
 * @subpackage api_v1_pages
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/filelib.php');
require_once($CFG->dirroot . '/mod/page/lib.php');
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * API endpoint class for page activity detail retrieval.
 *
 * Handles GET requests for individual page activity data, enforcing
 * permission checks and formatting responses for React frontend consumption.
 *
 * @package    core_api
 * @subpackage api_v1_pages
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class PagesShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request for page activity details.
     *
     * Retrieves page activity data including content, validates user permissions,
     * and returns formatted JSON response.
     *
     * @return void Outputs JSON response directly
     * @throws moodle_exception If page not found or permission denied
     */
    protected function handle_get() {
        global $DB, $USER;
        
        // Get page ID from URL path
        $pageid = required_param('id', PARAM_INT);
        
        // Get page record from database
        $page = $DB->get_record('page', array('id' => $pageid), '*', MUST_EXIST);
        
        // Get course module instance
        $cm = get_coursemodule_from_instance('page', $page->id, $page->course, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        
        // Enforce permission check
        require_capability('mod/page:view', $context);
        
        // Format page content for output
        $page->content = file_rewrite_pluginfile_urls(
            $page->content,
            'pluginfile.php',
            $context->id,
            'mod_page',
            'content',
            $page->revision
        );
        
        // Format intro text
        $page->intro = file_rewrite_pluginfile_urls(
            $page->intro,
            'pluginfile.php',
            $context->id,
            'mod_page',
            'intro',
            null
        );
        
        // Add course module information
        $page->cm_id = $cm->id;
        $page->course_module = [
            'id' => $cm->id,
            'visible' => $cm->visible,
            'section' => $cm->section,
            'availability' => $cm->availability
        ];
        
        // Return formatted response
        $this->json_response([
            'id' => $page->id,
            'course' => $page->course,
            'name' => $page->name,
            'intro' => $page->intro,
            'introformat' => $page->introformat,
            'content' => $page->content,
            'contentformat' => $page->contentformat,
            'legacyfiles' => $page->legacyfiles,
            'legacyfileslast' => $page->legacyfileslast,
            'display' => $page->display,
            'displayoptions' => $page->displayoptions,
            'revision' => $page->revision,
            'timemodified' => $page->timemodified,
            'cm_id' => $page->cm_id,
            'course_module' => $page->course_module
        ]);
    }
}

// Instantiate and execute the endpoint

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new api_v1_pages_show();
    $endpoint->execute();
}
