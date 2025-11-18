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
 * REST API endpoint for resource activity detail retrieval.
 *
 * Implements GET /api/v1/resources/{id} endpoint that returns comprehensive
 * resource activity metadata including file information, display settings,
 * and access URLs. This endpoint enables React frontend components to display
 * file-based resources (PDFs, documents, images, etc.) with proper permissions
 * enforcement and completion tracking.
 *
 * Key features:
 * - JWT token authentication via ApiBase parent class
 * - Validates resource existence in database
 * - Enforces mod/resource:view capability before returning data
 * - Retrieves file metadata from Moodle file storage
 * - Generates secure pluginfile URLs for file access
 * - Determines appropriate display type based on MIME type and settings
 * - Triggers view event for completion tracking
 * - Returns structured JSON response for React consumption
 *
 * Endpoint: GET /api/v1/resources/{id}
 * Parameters:
 *   - id (int, required): Resource instance ID from URL path
 *
 * Response structure:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "name": "Course Syllabus",
 *     "intro": "Introduction text...",
 *     "introformat": 1,
 *     "display": 5,
 *     "displayoptions": "a:2:{...}",
 *     "filterfiles": 0,
 *     "revision": 1,
 *     "timemodified": 1640000000,
 *     "course": 5,
 *     "coursemodule": 456,
 *     "section": 1,
 *     "visible": 1,
 *     "file": {
 *       "id": 789,
 *       "filename": "syllabus.pdf",
 *       "filesize": 245760,
 *       "mimetype": "application/pdf",
 *       "timecreated": 1640000000,
 *       "timemodified": 1640000000,
 *       "url": "https://moodle.site/pluginfile.php/123/mod_resource/content/1/syllabus.pdf"
 *     },
 *     "displaytype": 5
 *   },
 *   "meta": null
 * }
 *
 * Error responses:
 * - 400 Bad Request: Invalid resource ID parameter
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: User lacks mod/resource:view capability
 * - 404 Not Found: Resource does not exist
 * - 400 Validation Error: Resource has no files or needs migration
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and exception handlers
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Load Moodle configuration and core libraries (skip in test mode)
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    require_once(__DIR__ . '/../../../config.php');
    require_once($CFG->dirroot . '/mod/resource/lib.php');
    require_once($CFG->dirroot . '/mod/resource/locallib.php');
    require_once($CFG->libdir . '/filelib.php');
}

/**
 * Resource show endpoint class.
 *
 * Handles GET requests to retrieve resource activity details with file metadata.
 * Extends ApiBase to inherit JWT authentication, parameter extraction, capability
 * checking, and response formatting capabilities.
 */
class ResourceShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request for resource detail retrieval.
     *
     * This method implements the complete resource detail endpoint logic:
     * 1. Extracts and validates resource ID parameter from URL
     * 2. Retrieves resource record from database with existence validation
     * 3. Gets associated course module and course records
     * 4. Creates module context for capability checking
     * 5. Enforces mod/resource:view capability requirement
     * 6. Checks resource migration status (legacy resources)
     * 7. Retrieves file information from file storage system
     * 8. Validates at least one file exists for the resource
     * 9. Extracts comprehensive file metadata (name, size, MIME type, timestamps)
     * 10. Determines final display type based on settings and file type
     * 11. Generates secure pluginfile URL for file access
     * 12. Triggers resource view event for completion tracking
     * 13. Formats and returns complete resource data as JSON
     *
     * All business logic delegates to existing Moodle core functions following
     * the thin wrapper pattern - no logic duplication occurs in this endpoint.
     *
     * @return void Outputs JSON response via ApiResponse::success()
     * @throws ValidationException If resource ID is invalid or resource has validation issues
     * @throws NotFoundException If resource does not exist in database
     * @throws ForbiddenException If user lacks mod/resource:view capability
     */
    protected function handle_get() {
        global $DB;
        
        // Extract resource ID parameter from URL path
        // This comes from the URL pattern /api/v1/resources/{id}
        // PARAM_INT ensures the value is a valid integer
        $resourceid = $this->getParam('id', PARAM_INT, true);
        
        // Retrieve resource record from database
        // MUST_EXIST throws exception if not found (handled by try-catch below)
        $resource = $DB->get_record('resource', ['id' => $resourceid], '*', MUST_EXIST);
        
        // Handle case where database query unexpectedly returns false
        // This is defensive coding - MUST_EXIST should throw exception, but we check anyway
        if (!$resource) {
            throw new NotFoundException('Resource not found', [
                'resourceId' => $resourceid
            ]);
        }
        
        // Get course module from resource instance
        // This retrieves the course_modules record that links the resource to a course
        // Uses existing Moodle function - no business logic duplication
        $cm = get_coursemodule_from_instance('resource', $resource->id, $resource->course, false, MUST_EXIST);
        
        if (!$cm) {
            throw new NotFoundException('Course module not found for resource', [
                'resourceId' => $resourceid,
                'courseId' => $resource->course
            ]);
        }
        
        // Load course record for the resource
        // Required for resource_view() call and context validation
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        
        if (!$course) {
            throw new NotFoundException('Course not found', [
                'courseId' => $cm->course
            ]);
        }
        
        // Get module context for capability checking
        // Context is required to enforce permission checks at the module level
        $context = context_module::instance($cm->id);
        
        // Enforce viewing permission using Moodle's capability system
        // This calls require_capability() internally which throws moodle_exception
        // The exception is caught by ApiBase and converted to ForbiddenException
        $this->checkCapability('mod/resource:view', $context);
        
        // Check if resource needs migration from legacy format
        // Legacy resources (pre-2.0) have tobemigrated flag set
        if (!empty($resource->tobemigrated)) {
            throw new ValidationException('Resource needs migration', [
                'resourceId' => $resourceid,
                'reason' => 'This is a legacy resource that has not been migrated to the new format',
                'action' => 'Contact administrator to migrate this resource'
            ]);
        }
        
        // Get file storage instance to retrieve resource files
        // Uses existing Moodle file storage API - no duplication
        $fs = get_file_storage();
        
        // Retrieve all files for this resource from the content file area
        // Sorted by sortorder DESC, id ASC to get the main file first
        // The false parameter excludes directories from the result
        $files = $fs->get_area_files(
            $context->id,           // Context ID
            'mod_resource',         // Component name
            'content',              // File area name
            0,                      // Item ID (0 for resource content)
            'sortorder DESC, id ASC', // Sort order
            false                   // Exclude directories
        );
        
        // Validate that at least one file exists
        // Resources must have associated files to be viewable
        if (count($files) < 1) {
            throw new ValidationException('Resource has no files', [
                'resourceId' => $resourceid,
                'reason' => 'No files found in resource content area',
                'contextId' => $context->id
            ]);
        }
        
        // Get the main file (first file in sorted array)
        // reset() returns the first element and moves the internal pointer
        $file = reset($files);
        
        // Clean up files array to free memory
        unset($files);
        
        // Extract comprehensive file metadata using stored_file methods
        $filedata = [
            'id' => $file->get_id(),
            'filename' => $file->get_filename(),
            'filesize' => $file->get_filesize(),
            'mimetype' => $file->get_mimetype(),
            'timecreated' => $file->get_timecreated(),
            'timemodified' => $file->get_timemodified(),
        ];
        
        // Determine final display type based on resource settings and file MIME type
        // This resolves RESOURCELIB_DISPLAY_AUTO to concrete display type
        // Uses existing resource_get_final_display_type() function - no duplication
        $displaytype = resource_get_final_display_type($resource);
        
        // Determine if file should be forced to download based on display type
        $forcedownload = ($displaytype == RESOURCELIB_DISPLAY_DOWNLOAD);
        
        // Build file path for pluginfile.php URL generation
        // Format: /{contextid}/mod_resource/content/{revision}{filepath}{filename}
        $filepath = '/' . $context->id . '/mod_resource/content/' . $resource->revision . 
                    $file->get_filepath() . $file->get_filename();
        
        // Generate secure pluginfile URL for file access
        // This URL includes token validation and handles permissions automatically
        // Uses existing moodle_url::make_file_url() - no duplication
        $fileurl = moodle_url::make_file_url('/pluginfile.php', $filepath, $forcedownload);
        
        // Add file URL to file metadata
        $filedata['url'] = $fileurl->out(false);
        
        // Trigger view event and update completion status
        // This is critical for activity completion tracking and analytics
        // Calls existing resource_view() function - no business logic duplication
        resource_view($resource, $course, $cm, $context);
        
        // Build comprehensive response data structure
        $responseData = [
            'id' => (int)$resource->id,
            'name' => $resource->name,
            'intro' => $resource->intro,
            'introformat' => (int)$resource->introformat,
            'display' => (int)$resource->display,
            'displayoptions' => $resource->displayoptions,
            'filterfiles' => (int)$resource->filterfiles,
            'revision' => (int)$resource->revision,
            'timemodified' => (int)$resource->timemodified,
            'course' => (int)$resource->course,
            'coursemodule' => (int)$cm->id,
            'section' => (int)$cm->section,
            'visible' => (int)$cm->visible,
            'file' => $filedata,
            'displaytype' => $displaytype,
        ];
        
        // Send success response with resource data
        // This uses ApiBase::success() which sets CORS headers and formats response
        $this->success($responseData);
    }
    
    /**
     * Handle unsupported POST requests.
     *
     * Resource show endpoint only supports GET method. POST requests should
     * return a method not allowed error.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for resource detail endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle unsupported PUT requests.
     *
     * Resource show endpoint only supports GET method. PUT requests should
     * return a method not allowed error.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for resource detail endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle unsupported DELETE requests.
     *
     * Resource show endpoint only supports GET method. DELETE requests should
     * return a method not allowed error.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for resource detail endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
}

// Instantiate endpoint and execute request
// The ApiBase parent class handles all routing, authentication, and error handling
$endpoint = new ResourceShowEndpoint();
$endpoint->execute();
