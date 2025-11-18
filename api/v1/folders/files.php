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
 * REST API endpoint for folder files listing.
 *
 * Implements GET /api/v1/folders/{id}/files endpoint that returns a complete
 * list of all files contained within the folder, including subdirectories.
 * This endpoint enables React frontend components to display folder contents
 * with proper file metadata, download URLs, and hierarchical structure.
 *
 * Key features:
 * - JWT token authentication via ApiBase parent class
 * - Validates folder activity existence in database
 * - Enforces mod/folder:view capability before returning files
 * - Retrieves all files from content filearea
 * - Supports subdirectory structure representation
 * - Formats file information including URLs, sizes, and metadata
 * - Returns structured JSON response for React consumption
 *
 * Endpoint: GET /api/v1/folders/{id}/files
 * Parameters:
 *   - id (int, required): Folder instance ID from URL path
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
 *         "url": "https://example.com/pluginfile.php/...",
 *         "is_directory": false
 *       },
 *       {
 *         "id": 124,
 *         "filename": "subfolder",
 *         "filepath": "/subfolder/",
 *         "filesize": 0,
 *         "mimetype": null,
 *         "timemodified": 1637772000,
 *         "url": null,
 *         "is_directory": true
 *       }
 *     ],
 *     "total": 2,
 *     "total_size": 1024000
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
require_once($CFG->dirroot . '/mod/folder/locallib.php');
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * API endpoint class for folder files listing.
 *
 * Handles GET requests for folder file listings, enforcing
 * permission checks and formatting responses for React frontend consumption.
 *
 * @package    core_api
 * @subpackage api_v1_folders
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class api_v1_folders_files extends api_base {
    
    /**
     * Handle GET request for folder files.
     *
     * Retrieves all files from the folder including subdirectories
     * and formats them for React consumption.
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
        
        // Get file storage
        $fs = get_file_storage();
        
        // Retrieve all files from content area (including directories)
        $files = $fs->get_area_files(
            $context->id,
            'mod_folder',
            'content',
            0,
            'filepath, filename',
            true  // Include directories
        );
        
        // Format files for output
        $filedata = [];
        $total_size = 0;
        
        foreach ($files as $file) {
            // Skip the root directory entry
            if ($file->get_filepath() === '/' && $file->get_filename() === '.') {
                continue;
            }
            
            $is_directory = $file->is_directory();
            
            // Generate pluginfile URL for non-directories
            $url = null;
            if (!$is_directory) {
                $url = moodle_url::make_pluginfile_url(
                    $context->id,
                    'mod_folder',
                    'content',
                    0,
                    $file->get_filepath(),
                    $file->get_filename(),
                    $folder->forcedownload
                );
                $url = $url->out(false);
                $total_size += $file->get_filesize();
            }
            
            $filedata[] = [
                'id' => $file->get_id(),
                'filename' => $file->get_filename(),
                'filepath' => $file->get_filepath(),
                'filesize' => $file->get_filesize(),
                'mimetype' => $file->get_mimetype(),
                'timemodified' => $file->get_timemodified(),
                'url' => $url,
                'is_directory' => $is_directory,
                'author' => $file->get_author(),
                'license' => $file->get_license()
            ];
        }
        
        // Return formatted response
        $this->json_response([
            'files' => $filedata,
            'total' => count($filedata),
            'total_size' => $total_size
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new api_v1_folders_files();
$endpoint->execute();
