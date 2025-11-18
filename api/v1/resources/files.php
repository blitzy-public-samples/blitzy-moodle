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
 * REST API endpoint for retrieving complete file listing of a resource activity.
 *
 * Implements GET /api/v1/resources/{id}/files endpoint that returns comprehensive
 * file metadata for all files associated with a resource module instance. This
 * endpoint enables React frontend components to:
 * - Display file galleries with multiple files in a single resource
 * - Show detailed file information (size, type, author, license)
 * - Generate download and thumbnail URLs for client-side file access
 * - Render file browsers with comprehensive metadata
 *
 * Key features:
 * - Returns ALL files in resource (not just main file), excluding directories
 * - Generates pluginfile URLs for secure download access with proper context
 * - Provides thumbnail URLs for image and video files for preview functionality
 * - Includes comprehensive file metadata: mimetype, size, author, license, timestamps
 * - Enforces mod/resource:view capability before file access
 * - Triggers resource view event for activity completion tracking
 * - Supports resources with single or multiple attached files
 *
 * Technical implementation:
 * - Extends ApiBase for JWT authentication and error handling
 * - Uses get_file_storage() and get_area_files() from Moodle core
 * - Delegates all file retrieval logic to existing Moodle file API
 * - Generates URLs via moodle_url::make_file_url() for proper security
 * - No business logic duplication - thin wrapper over Moodle functions
 *
 * Response structure:
 * {
 *   "success": true,
 *   "data": {
 *     "resourceid": 123,
 *     "resourcename": "Course Introduction Slides",
 *     "files": [
 *       {
 *         "id": 456,
 *         "filename": "slides.pdf",
 *         "filepath": "/",
 *         "filesize": 2048576,
 *         "filesizedisplay": "2.0MB",
 *         "mimetype": "application/pdf",
 *         "mimetypeicon": "pdf-24.png",
 *         "author": "John Smith",
 *         "license": "allrightsreserved",
 *         "timemodified": 1698765432,
 *         "url": "https://moodle.site/pluginfile.php/123/mod_resource/content/0/slides.pdf",
 *         "thumbnailurl": null,
 *         "isimage": false,
 *         "isvideo": false
 *       }
 *     ]
 *   },
 *   "meta": null
 * }
 *
 * @package    api_v1
 * @subpackage resources
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and required libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/resource/lib.php');
require_once($CFG->libdir . '/filelib.php');
require_once($CFG->libdir . '/completionlib.php');

// Load API base class and utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_response.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Resource files listing API endpoint.
 *
 * Handles GET requests to /api/v1/resources/{id}/files, returning comprehensive
 * file listings for resource module instances with complete metadata suitable
 * for React file browser and gallery components.
 */
class ResourceFilesEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve resource file listing.
     *
     * This method implements the complete file retrieval workflow:
     * 1. Extract and validate resource ID from request parameters
     * 2. Retrieve resource record from database with existence validation
     * 3. Get course module and course records for context
     * 4. Establish module context for permission checking
     * 5. Enforce mod/resource:view capability requirement
     * 6. Retrieve file storage instance from Moodle core
     * 7. Get all files associated with the resource (excluding directories)
     * 8. Build comprehensive file metadata array for each file:
     *    - Basic properties: ID, filename, filepath, filesize
     *    - Human-readable filesize display format
     *    - MIME type information and icon
     *    - Author, license, and modification timestamp
     *    - Download URL via pluginfile.php with proper security
     *    - Thumbnail URL for image/video files
     *    - Boolean flags for file type detection (isimage, isvideo)
     * 9. Trigger resource view event for completion tracking
     * 10. Return JSON response with resource info and files array
     *
     * Error handling:
     * - NotFoundException: Invalid resource ID or no files found
     * - ForbiddenException: User lacks mod/resource:view capability
     * - ValidationException: Invalid or missing ID parameter
     *
     * @return void Outputs JSON response directly via ApiResponse
     * @throws NotFoundException If resource not found or has no files
     * @throws ForbiddenException If user lacks view permission
     * @throws ValidationException If ID parameter is invalid
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Extract resource ID from request parameters (required integer parameter)
        $resourceid = $this->getParam('id', PARAM_INT, true);
        
        // Retrieve resource record from database
        // MUST_EXIST flag causes dml_missing_record_exception if not found,
        // which ApiBase converts to NotFoundException with 404 status
        $resource = $DB->get_record('resource', ['id' => $resourceid], '*', MUST_EXIST);
        
        // Get course module record for this resource instance
        // This provides the course module ID (cm->id) needed for context and completion
        // MUST_EXIST flag ensures exception if course module not found
        $cm = get_coursemodule_from_instance('resource', $resource->id, $resource->course, false, MUST_EXIST);
        
        // Get course record for completion and view event
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        
        // Establish module context for permission checking and file access
        // Context defines the scope for capability checks and file storage areas
        $context = context_module::instance($cm->id);
        
        // Enforce viewing permission using Moodle capability system
        // Throws ForbiddenException if user lacks mod/resource:view capability
        // This delegates to require_capability() without duplicating permission logic
        $this->checkCapability('mod/resource:view', $context);
        
        // Get file storage instance from Moodle core
        // This provides access to the file storage API for retrieving stored files
        $fs = get_file_storage();
        
        // Retrieve ALL files associated with this resource
        // Parameters:
        // - $context->id: Context ID for this course module
        // - 'mod_resource': Component name for resource module
        // - 'content': File area name where resource files are stored
        // - 0: Item ID (0 for resource module)
        // - 'sortorder DESC, id ASC': Sort files by sortorder descending, then ID ascending
        // - false: Exclude directories (only return actual files)
        //
        // This returns an array of stored_file objects, one for each file in the resource
        $files = $fs->get_area_files($context->id, 'mod_resource', 'content', 0, 'sortorder DESC, id ASC', false);
        
        // Validate that resource has at least one file
        // Resources without files cannot be displayed properly
        if (empty($files)) {
            throw new NotFoundException('No files found for this resource', [
                'resourceid' => $resourceid,
                'reason' => 'Resource has no associated files'
            ]);
        }
        
        // Build array of file metadata for JSON response
        $filesdata = [];
        
        // Iterate through each stored_file object to extract comprehensive metadata
        foreach ($files as $file) {
            // Get basic file properties using stored_file methods
            $fileid = $file->get_id();
            $filename = $file->get_filename();
            $filepath = $file->get_filepath();
            $filesize = $file->get_filesize();
            $mimetype = $file->get_mimetype();
            $timemodified = $file->get_timemodified();
            $author = $file->get_author();
            $license = $file->get_license();
            
            // Generate human-readable file size display (e.g., "2.5 MB")
            // display_size() is a Moodle core function that formats bytes nicely
            $filesizedisplay = display_size($filesize);
            
            // Get MIME type icon filename for displaying file type icons
            // mimeinfo() returns the icon filename from Moodle's MIME type registry
            $mimetypeicon = mimeinfo('icon', $filename);
            
            // Determine if file is an image for preview/thumbnail generation
            // file_mimetype_in_typegroup() checks MIME type against predefined groups
            $isimage = file_mimetype_in_typegroup($mimetype, 'web_image');
            
            // Determine if file is a video for preview/player rendering
            $isvideo = file_mimetype_in_typegroup($mimetype, 'web_video');
            
            // Build file path for pluginfile.php URL generation
            // Format: /contextid/component/filearea/itemid/filepath/filename
            // This path is used by Moodle's file serving infrastructure
            $path = '/' . $context->id . '/mod_resource/content/' . $resource->revision . $filepath . $filename;
            
            // Generate download URL using Moodle's file serving system
            // moodle_url::make_file_url() creates properly formatted pluginfile URLs
            // Parameters:
            // - '/pluginfile.php': Moodle's file serving script
            // - $path: Full file path including context, component, filearea
            // - false: Don't force download (allow inline display for images/PDFs)
            //
            // This returns a moodle_url object which we convert to string
            $downloadurl = moodle_url::make_file_url('/pluginfile.php', $path, false);
            $url = $downloadurl->out(false); // Get URL as string without wwwroot encoding
            
            // Generate thumbnail URL for images and videos
            // For images, add preview parameter to generate thumbnail
            // For videos, add preview parameter to extract video thumbnail frame
            $thumbnailurl = null;
            if ($isimage || $isvideo) {
                // Build thumbnail path with preview parameter
                // Moodle's pluginfile.php will generate/serve thumbnail when preview is set
                $thumbpath = '/' . $context->id . '/mod_resource/content/' . $resource->revision . $filepath . $filename;
                $thumburl = moodle_url::make_file_url('/pluginfile.php', $thumbpath, false);
                
                // Add preview parameter to trigger thumbnail generation
                $thumburl->param('preview', 'thumb');
                $thumbnailurl = $thumburl->out(false);
            }
            
            // Build comprehensive file metadata object for JSON response
            // This structure provides all information needed by React file browser components
            $filedata = [
                'id' => $fileid,
                'filename' => $filename,
                'filepath' => $filepath,
                'filesize' => $filesize,
                'filesizedisplay' => $filesizedisplay,
                'mimetype' => $mimetype,
                'mimetypeicon' => $mimetypeicon,
                'author' => $author,
                'license' => $license,
                'timemodified' => $timemodified,
                'url' => $url,
                'thumbnailurl' => $thumbnailurl,
                'isimage' => $isimage,
                'isvideo' => $isvideo,
            ];
            
            // Add file metadata to response array
            $filesdata[] = $filedata;
        }
        
        // Trigger resource view event for activity completion tracking
        // resource_view() fires mod_resource\event\course_module_viewed event
        // and updates completion status if completion tracking is enabled
        // This delegates to existing Moodle event/completion system without reimplementation
        resource_view($resource, $course, $cm, $context);
        
        // Build final response data structure
        $responsedata = [
            'resourceid' => $resource->id,
            'resourcename' => $resource->name,
            'files' => $filesdata,
        ];
        
        // Send success response with file listing data
        // ApiBase::success() method formats response as:
        // {"success": true, "data": {...}, "meta": null}
        // Sets HTTP 200 status code and appropriate headers
        $this->success($responsedata);
    }
    
    /**
     * Handle POST method - not supported for this endpoint.
     *
     * Resource file listing is read-only via GET. File uploads should use
     * dedicated file upload endpoints or course editing interfaces.
     *
     * @throws MethodNotAllowedException Always thrown to indicate POST not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for file listing', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT method - not supported for this endpoint.
     *
     * Resource file listing is read-only via GET. File modifications should use
     * dedicated file management endpoints or course editing interfaces.
     *
     * @throws MethodNotAllowedException Always thrown to indicate PUT not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for file listing', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE method - not supported for this endpoint.
     *
     * Resource file listing is read-only via GET. File deletion should use
     * dedicated file management endpoints or course editing interfaces.
     *
     * @throws MethodNotAllowedException Always thrown to indicate DELETE not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for file listing', [
            'allowedMethods' => ['GET']
        ]);
    }
}

// Instantiate endpoint and execute request only when not in test mode
// ApiBase constructor handles JWT authentication automatically
// execute() method routes to appropriate handle_* method based on HTTP verb
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new ResourceFilesEndpoint();
    $endpoint->execute();
}
