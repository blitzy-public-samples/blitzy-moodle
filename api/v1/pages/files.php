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
 * REST API endpoint for page activity embedded files retrieval.
 *
 * Implements GET /api/v1/pages/{id}/files endpoint that returns a list of
 * all files embedded in the page content area. This endpoint enables React
 * frontend components to display file metadata, generate download links,
 * and provide file management functionality.
 *
 * Key features:
 * - JWT token authentication via ApiBase parent class
 * - Validates page existence in database
 * - Enforces mod/page:view capability before returning files
 * - Retrieves all files from content filearea
 * - Formats file information including URLs, sizes, and metadata
 * - Returns structured JSON response for React consumption
 *
 * Endpoint: GET /api/v1/pages/{id}/files
 * Parameters:
 *   - id (int, required): Page instance ID from URL path
 *
 * Response structure:
 * {
 *   "success": true,
 *   "data": {
 *     "files": [
 *       {
 *         "id": 123,
 *         "filename": "document.pdf",
 *         "filepath": "/",
 *         "filesize": 1024000,
 *         "mimetype": "application/pdf",
 *         "timemodified": 1637772000,
 *         "url": "https://example.com/pluginfile.php/..."
 *       }
 *     ],
 *     "total": 1
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
 * API endpoint class for page embedded files retrieval.
 *
 * Handles GET requests for page activity file listings, enforcing
 * permission checks and formatting responses for React frontend consumption.
 *
 * @package    core_api
 * @subpackage api_v1_pages
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class PagesFilesEndpoint extends ApiBase {
    
    /**
     * Handle GET request for page embedded files.
     *
     * Retrieves all files from the page content filearea and formats
     * them for React consumption.
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
        
        // Get file storage
        $fs = get_file_storage();
        
        // Retrieve files from content area
        $files = $fs->get_area_files(
            $context->id,
            'mod_page',
            'content',
            0,
            'filename',
            false  // Exclude directories
        );
        
        // Format files for output
        $filedata = [];
        foreach ($files as $file) {
            // Generate pluginfile URL
            $url = moodle_url::make_pluginfile_url(
                $context->id,
                'mod_page',
                'content',
                0,
                $file->get_filepath(),
                $file->get_filename()
            );
            
            $filedata[] = [
                'id' => $file->get_id(),
                'filename' => $file->get_filename(),
                'filepath' => $file->get_filepath(),
                'filesize' => $file->get_filesize(),
                'mimetype' => $file->get_mimetype(),
                'timemodified' => $file->get_timemodified(),
                'url' => $url->out(false),
                'author' => $file->get_author(),
                'license' => $file->get_license()
            ];
        }
        
        // Return formatted response
        $this->json_response([
            'files' => $filedata,
            'total' => count($filedata)
        ]);
    }
    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for page files listing');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for page files listing');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for page files listing');
    }
}

// Instantiate and execute the endpoint

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new api_v1_pages_files();
    $endpoint->execute();
}
