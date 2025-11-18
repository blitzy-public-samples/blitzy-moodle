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
 * REST API endpoint for retrieving folder module contents with hierarchical structure.
 *
 * Implements GET /api/v1/resources/folders/{id} endpoint to retrieve folder contents
 * including hierarchical file tree and flat file list. Wraps existing Moodle folder
 * module functions to provide folder data, enforce permissions, trigger view events,
 * and update completion tracking.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include required Moodle libraries
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/folder/lib.php');
require_once($CFG->libdir . '/completionlib.php');
require_once($CFG->libdir . '/filelib.php');

/**
 * Folder resource API endpoint class.
 *
 * Extends ApiBase to provide GET endpoint for retrieving folder module contents
 * with hierarchical file structure. Enforces mod/folder:view capability, triggers
 * view events, updates completion tracking, and returns both tree and flat file
 * structures for flexible React frontend display.
 *
 * Example request:
 * GET /api/v1/resources/folders/123
 * Authorization: Bearer <jwt_token>
 *
 * Example response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "name": "Course Resources",
 *     "intro": "Welcome to the course resources folder",
 *     "introhtml": "<p>Welcome to the course resources folder</p>",
 *     "display": 0,
 *     "showexpanded": true,
 *     "showdownloadfolder": true,
 *     "forcedownload": false,
 *     "timemodified": 1640995200,
 *     "course": 5,
 *     "coursemodule": 42,
 *     "section": 2,
 *     "visible": 1,
 *     "tree": [
 *       {
 *         "type": "folder",
 *         "path": "/documents/",
 *         "name": "documents",
 *         "children": [
 *           {
 *             "type": "file",
 *             "id": 456,
 *             "filename": "syllabus.pdf",
 *             "filepath": "/documents/",
 *             "filesize": 524288,
 *             "filesizedisplay": "512KB",
 *             "mimetype": "application/pdf",
 *             "author": "John Doe",
 *             "timemodified": 1640995200,
 *             "url": "https://moodle.example.com/pluginfile.php/..."
 *           }
 *         ]
 *       }
 *     ],
 *     "flatfiles": [...]
 *   }
 * }
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class FolderResourceApi extends ApiBase {
    
    /**
     * Handle GET request for folder contents.
     *
     * Retrieves folder record, loads course module and course, enforces viewing
     * permission, checks inline display mode, triggers view event, updates completion,
     * retrieves all files from folder, builds hierarchical tree structure, extracts
     * file metadata, and returns comprehensive folder data with both tree and flat
     * file structures.
     *
     * @return void Outputs JSON response via $this->success()
     * @throws NotFoundException If folder record not found
     * @throws ForbiddenException If permission denied or inline display mode
     */
    public function handle_get() {
        global $DB, $CFG;
        
        // Step 1: Extract folder instance ID from URL parameter
        $folderid = $this->getParam('id', PARAM_INT);
        if (!$folderid) {
            throw new NotFoundException('Folder ID is required');
        }
        
        // Step 2: Load folder record from database
        $folder = $DB->get_record('folder', ['id' => $folderid], '*', MUST_EXIST);
        if (!$folder) {
            throw new NotFoundException('Folder not found', ['folderId' => $folderid]);
        }
        
        // Step 3: Load course module using get_coursemodule_from_instance()
        $cm = get_coursemodule_from_instance('folder', $folder->id, $folder->course, true, MUST_EXIST);
        if (!$cm) {
            throw new NotFoundException('Course module not found for folder', ['folderId' => $folderid]);
        }
        
        // Step 4: Load course record
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        if (!$course) {
            throw new NotFoundException('Course not found', ['courseId' => $cm->course]);
        }
        
        // Step 5: Get module context
        $context = context_module::instance($cm->id);
        
        // Step 6: Check mod/folder:view capability
        $this->checkCapability('mod/folder:view', $context);
        
        // Step 7: Check inline display mode - throw ForbiddenException if inline
        // Inline folders (display == FOLDER_DISPLAY_INLINE) should be displayed within
        // course page context, not as standalone API resources
        if ($folder->display == FOLDER_DISPLAY_INLINE) {
            throw new ForbiddenException(
                'This folder uses inline display mode and must be viewed within the course page',
                ['folderId' => $folderid, 'display' => $folder->display]
            );
        }
        
        // Step 8: Trigger course_module_viewed event
        $event = \mod_folder\event\course_module_viewed::create([
            'objectid' => $folder->id,
            'context' => $context,
        ]);
        $event->add_record_snapshot('course', $course);
        $event->add_record_snapshot('folder', $folder);
        $event->add_record_snapshot('course_modules', $cm);
        $event->trigger();
        
        // Step 9: Update completion tracking
        $completion = new completion_info($course);
        $completion->set_module_viewed($cm);
        
        // Step 10: Get file storage instance
        $fs = get_file_storage();
        
        // Step 11: Retrieve files using get_area_files() sorted by filepath, filename
        // Exclude directories (last parameter = false)
        $files = $fs->get_area_files(
            $context->id,
            'mod_folder',
            'content',
            0,
            'filepath, filename',
            false
        );
        
        // Step 12-14: Build hierarchical tree structure and extract metadata
        $tree = [];
        $flatfiles = [];
        $foldermap = []; // Map to track folder nodes by path
        
        foreach ($files as $file) {
            // Extract file metadata
            $fileinfo = $this->extractFileMetadata($file, $context);
            
            // Add to flat files array
            $flatfiles[] = $fileinfo;
            
            // Parse filepath to build tree hierarchy
            $filepath = $file->get_filepath();
            
            // Split filepath into directory components
            // filepath format: /path/to/folder/ or /
            $pathparts = array_filter(explode('/', trim($filepath, '/')), 'strlen');
            
            // Navigate/create folder structure in tree
            $currentlevel = &$tree;
            $currentpath = '/';
            
            foreach ($pathparts as $part) {
                $currentpath .= $part . '/';
                
                // Check if folder node exists at this level
                if (!isset($foldermap[$currentpath])) {
                    // Create new folder node
                    $foldernode = [
                        'type' => 'folder',
                        'path' => $currentpath,
                        'name' => $part,
                        'children' => [],
                    ];
                    
                    $currentlevel[] = $foldernode;
                    
                    // Store reference to this folder node for future access
                    $foldermap[$currentpath] = &$currentlevel[count($currentlevel) - 1];
                    
                    // Move current level to this folder's children
                    $currentlevel = &$foldermap[$currentpath]['children'];
                } else {
                    // Folder already exists, navigate to its children
                    $currentlevel = &$foldermap[$currentpath]['children'];
                }
            }
            
            // Add file to current level (either root or deepest folder)
            $currentlevel[] = $fileinfo;
        }
        
        // Step 15: Format and return JSON response
        $response = [
            'id' => (int)$folder->id,
            'name' => $folder->name,
            'intro' => $folder->intro,
            'introhtml' => format_module_intro('folder', $folder, $cm->id),
            'display' => (int)$folder->display,
            'showexpanded' => (bool)($folder->showexpanded ?? false),
            'showdownloadfolder' => (bool)($folder->showdownloadfolder ?? false),
            'forcedownload' => (bool)($folder->forcedownload ?? false),
            'timemodified' => (int)$folder->timemodified,
            'course' => (int)$folder->course,
            'coursemodule' => (int)$cm->id,
            'section' => (int)$cm->section,
            'visible' => (int)$cm->visible,
            'tree' => $tree,
            'flatfiles' => $flatfiles,
        ];
        
        $this->success($response);
    }
    
    /**
     * Extract comprehensive metadata from a stored file.
     *
     * Retrieves all relevant file properties including ID, filename, filepath,
     * filesize with display formatting, mimetype, author, timestamps, and
     * generates download URL using pluginfile.php.
     *
     * @param stored_file $file The file object to extract metadata from
     * @param context $context The module context for URL generation
     * @return array Associative array with file metadata
     */
    private function extractFileMetadata($file, $context) {
        global $CFG;
        
        // Generate download URL using pluginfile.php
        // Format: /pluginfile.php/{contextid}/mod_folder/content/0{filepath}{filename}
        $filepath = $file->get_filepath();
        $filename = $file->get_filename();
        $path = '/' . $context->id . '/mod_folder/content/0' . $filepath . $filename;
        
        // Use moodle_url::make_file_url() for download URL generation
        $downloadurl = moodle_url::make_file_url('/pluginfile.php', $path, false);
        
        return [
            'type' => 'file',
            'id' => (int)$file->get_id(),
            'filename' => $filename,
            'filepath' => $filepath,
            'filesize' => (int)$file->get_filesize(),
            'filesizedisplay' => display_size($file->get_filesize()),
            'mimetype' => $file->get_mimetype(),
            'author' => $file->get_author(),
            'timemodified' => (int)$file->get_timemodified(),
            'url' => $downloadurl->out(false),
        ];
    }
    
    /**
     * Handle POST request - not allowed for folder resource endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not allowed for folder resource endpoint');
    }
    
    /**
     * Handle PUT request - not allowed for folder resource endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not allowed for folder resource endpoint');
    }
    
    /**
     * Handle DELETE request - not allowed for folder resource endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed for folder resource endpoint');
    }
}

// Instantiate and execute the API endpoint
$api = new FolderResourceApi();
$api->execute();
