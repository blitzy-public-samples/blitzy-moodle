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
 * REST API endpoint for page content retrieval.
 *
 * Implements GET /api/v1/pages/{id}/content endpoint that returns the formatted
 * HTML content of a page activity with all pluginfile URLs properly rewritten.
 * This endpoint enables React frontend components to display page content with
 * embedded images, files, and media.
 *
 * Key features:
 * - JWT token authentication via ApiBase parent class
 * - Validates page existence in database
 * - Enforces mod/page:view capability before returning content
 * - Rewrites pluginfile URLs for correct file access
 * - Processes filters on content
 * - Returns formatted HTML ready for rendering
 *
 * Endpoint: GET /api/v1/pages/{id}/content
 * Parameters:
 *   - id (int, required): Page instance ID from URL path
 *
 * Response structure:
 * {
 *   "success": true,
 *   "data": {
 *     "content": "<p>Formatted HTML content...</p>",
 *     "contentformat": 1,
 *     "lastmodified": 1637772000
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

// Only require config if not already loaded (for test compatibility)
if (!defined('MOODLE_INTERNAL')) {
    require_once(__DIR__ . '/../../../config.php');
}
require_once($CFG->dirroot . '/lib/filelib.php');
require_once($CFG->dirroot . '/mod/page/lib.php');
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * API endpoint class for page content retrieval.
 *
 * Handles GET requests for page activity content, enforcing
 * permission checks and formatting responses for React frontend consumption.
 *
 * @package    core_api
 * @subpackage api_v1_pages
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class PagesContentEndpoint extends ApiBase {
    
    /**
     * Handle GET request for page content.
     *
     * Retrieves formatted HTML content for the page, with pluginfile URLs
     * rewritten and filters applied.
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
        
        // Format content with pluginfile URLs
        $content = file_rewrite_pluginfile_urls(
            $page->content,
            'pluginfile.php',
            $context->id,
            'mod_page',
            'content',
            $page->revision
        );
        
        // Apply filters to content
        $formatoptions = new stdClass();
        $formatoptions->noclean = true;
        $formatoptions->overflowdiv = true;
        $formatoptions->context = $context;
        
        $content = format_text($content, $page->contentformat, $formatoptions);
        
        // Return formatted response
        $this->json_response([
            'content' => $content,
            'contentformat' => $page->contentformat,
            'lastmodified' => $page->timemodified
        ]);
    }
    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for page content');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for page content');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for page content');
    }
}

// Instantiate and execute the endpoint

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new api_v1_pages_content();
    $endpoint->execute();
}
