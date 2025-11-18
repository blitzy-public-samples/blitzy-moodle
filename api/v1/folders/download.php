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
 * REST API endpoint for folder download as ZIP archive.
 *
 * Implements GET /api/v1/folders/{id}/download endpoint that generates
 * and serves a ZIP archive containing all files from the folder including
 * subdirectories. This endpoint enables React frontend components to provide
 * "Download folder" functionality matching existing Moodle behavior.
 *
 * Key features:
 * - JWT token authentication via ApiBase parent class
 * - Validates folder activity existence in database
 * - Enforces mod/folder:view capability before generating archive
 * - Checks if download folder feature is enabled in settings
 * - Creates temporary ZIP archive with all folder contents
 * - Preserves directory structure in ZIP
 * - Serves file with proper headers for browser download
 * - Cleans up temporary files after download
 *
 * Endpoint: GET /api/v1/folders/{id}/download
 * Parameters:
 *   - id (int, required): Folder instance ID from URL path
 *
 * Response: Binary ZIP file with headers:
 *   - Content-Type: application/zip
 *   - Content-Disposition: attachment; filename="foldername.zip"
 *   - Content-Length: [file size]
 *
 * Error responses:
 * - 404: Folder activity not found
 * - 403: Permission denied (missing mod/folder:view capability)
 * - 403: Download folder feature disabled
 * - 401: Unauthorized (invalid JWT token)
 * - 500: Failed to generate ZIP archive
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
 * API endpoint class for folder ZIP download.
 *
 * Handles GET requests for folder downloads as ZIP archives, enforcing
 * permission checks and serving files with proper HTTP headers.
 *
 * @package    core_api
 * @subpackage api_v1_folders
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class api_v1_folders_download extends ApiBase {
    
    /**
     * Handle GET request for folder download.
     *
     * Generates a ZIP archive of all folder contents and serves it
     * to the client as a downloadable file.
     *
     * @return void Serves file directly (does not return JSON)
     * @throws moodle_exception If folder activity not found, permission denied, or ZIP generation fails
     */
    protected function handle_get() {
        global $DB, $USER, $CFG;
        
        // Get folder ID from URL path
        $folderid = required_param('id', PARAM_INT);
        
        // Get folder record from database
        $folder = $DB->get_record('folder', array('id' => $folderid), '*', MUST_EXIST);
        
        // Get course module instance
        $cm = get_coursemodule_from_instance('folder', $folder->id, $folder->course, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        
        // Enforce permission check
        require_capability('mod/folder:view', $context);
        
        // Check if download folder is enabled
        if (empty($folder->showdownloadfolder)) {
            throw new moodle_exception('downloadfolderdisabled', 'mod_folder');
        }
        
        // Get file storage
        $fs = get_file_storage();
        
        // Get all files from content area
        $files = $fs->get_area_files(
            $context->id,
            'mod_folder',
            'content',
            0,
            'filepath, filename',
            false  // Exclude directories from the listing
        );
        
        // If no files, return error
        if (empty($files)) {
            throw new moodle_exception('nofiles', 'mod_folder');
        }
        
        // Create a temporary directory for the ZIP
        $tempdir = make_temp_directory('folder_downloads');
        $zipfilename = clean_filename($folder->name . '.zip');
        $zipfilepath = $tempdir . '/' . $zipfilename;
        
        // Remove existing file if present
        if (file_exists($zipfilepath)) {
            unlink($zipfilepath);
        }
        
        // Create ZIP archive
        $zipper = new zip_packer();
        $filesforzipping = [];
        
        foreach ($files as $file) {
            // Create path preserving directory structure
            $path = ltrim($file->get_filepath(), '/');
            $filename = $file->get_filename();
            $filesforzipping[$path . $filename] = $file;
        }
        
        // Pack files into ZIP
        $success = $zipper->archive_to_pathname($filesforzipping, $zipfilepath);
        
        if (!$success) {
            throw new moodle_exception('cannotcreatezip', 'mod_folder');
        }
        
        // Log the download event
        $event = \mod_folder\event\folder_downloaded::create([
            'context' => $context,
            'objectid' => $folder->id
        ]);
        $event->add_record_snapshot('course', $DB->get_record('course', ['id' => $folder->course]));
        $event->add_record_snapshot('folder', $folder);
        $event->trigger();
        
        // Serve the file
        send_temp_file($zipfilepath, $zipfilename);
        
        // File serving ends script execution
        die;
    }
}

// Instantiate and execute the endpoint
$endpoint = new api_v1_folders_download();
$endpoint->execute();
