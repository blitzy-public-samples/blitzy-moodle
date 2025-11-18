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
 * REST API endpoint for folder activity detail retrieval.
 *
 * Implements GET /api/v1/folders/{id} endpoint that returns comprehensive
 * folder activity metadata including configuration, display settings, and
 * basic folder information. This endpoint enables React frontend components
 * to display folder details with proper permissions enforcement.
 *
 * Key features:
 * - JWT token authentication via ApiBase parent class
 * - Validates folder activity existence in database
 * - Enforces mod/folder:view capability before returning data
 * - Retrieves folder configuration and metadata
 * - Formats folder information for React rendering
 * - Returns structured JSON response for React consumption
 *
 * Endpoint: GET /api/v1/folders/{id}
 * Parameters:
 *   - id (int, required): Folder instance ID from URL path
 *
 * Response structure:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "course": 5,
 *     "name": "Course Materials",
 *     "intro": "Introduction text...",
 *     "introformat": 1,
 *     "revision": 1,
 *     "timemodified": 1637772000,
 *     "display": 0,
 *     "showexpanded": 1,
 *     "showdownloadfolder": 1,
 *     "forcedownload": 0,
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
 * - 404: Folder activity not found
 * - 403: Permission denied (missing mod/folder:view capability)
 * - 401: Unauthorized (invalid JWT token)
 *
 * @package    core_api
 * @subpackage api_v1_folders
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/filelib.php');
require_once($CFG->dirroot . '/mod/folder/lib.php');
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * API endpoint class for folder activity detail retrieval.
 *
 * Handles GET requests for individual folder activity data, enforcing
 * permission checks and formatting responses for React frontend consumption.
 *
 * @package    core_api
 * @subpackage api_v1_folders
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class FoldersShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request for folder activity details.
     *
     * Retrieves folder activity data, validates user permissions,
     * and returns formatted JSON response.
     *
     * @return void Outputs JSON response directly
     * @throws moodle_exception If folder activity not found or permission denied
     */
    protected function handle_get() {
        global $DB, $USER;
        
        // Get folder ID from URL path
        $folderid = required_param('id', PARAM_INT);
        
        // Get folder record from database
        $folder = $DB->get_record('folder', array('id' => $folderid), '*', MUST_EXIST);
        
        // Get course module instance
        $cm = get_coursemodule_from_instance('folder', $folder->id, $folder->course, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        
        // Enforce permission check
        require_capability('mod/folder:view', $context);
        
        // Format intro text with pluginfile URLs
        $folder->intro = file_rewrite_pluginfile_urls(
            $folder->intro,
            'pluginfile.php',
            $context->id,
            'mod_folder',
            'intro',
            null
        );
        
        // Add course module information
        $folder->cm_id = $cm->id;
        $folder->course_module = [
            'id' => $cm->id,
            'visible' => $cm->visible,
            'section' => $cm->section,
            'availability' => $cm->availability
        ];
        
        // Return formatted response
        $this->json_response([
            'id' => $folder->id,
            'course' => $folder->course,
            'name' => $folder->name,
            'intro' => $folder->intro,
            'introformat' => $folder->introformat,
            'revision' => $folder->revision,
            'timemodified' => $folder->timemodified,
            'display' => $folder->display,
            'showexpanded' => $folder->showexpanded,
            'showdownloadfolder' => $folder->showdownloadfolder,
            'forcedownload' => $folder->forcedownload,
            'cm_id' => $folder->cm_id,
            'course_module' => $folder->course_module
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new api_v1_folders_show();
$endpoint->execute();
