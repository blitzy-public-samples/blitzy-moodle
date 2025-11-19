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
 * REST API endpoint for retrieving assignment files.
 *
 * Returns file metadata and download URLs for assignment files including
 * intro files and intro attachments. Uses existing Moodle file storage API
 * to retrieve files from the 'intro' and 'introattachment' file areas.
 * 
 * Endpoint: GET /api/v1/assignments/{id}/files
 * 
 * Authentication: JWT token required via Authorization header
 * Permission: mod/assign:view capability in assignment context
 * 
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "intro": [
 *       {
 *         "id": "contenthash",
 *         "filename": "example.pdf",
 *         "filesize": 1024,
 *         "mimetype": "application/pdf",
 *         "timemodified": 1234567890,
 *         "filepath": "/",
 *         "url": "https://moodle.example.com/pluginfile.php/..."
 *       }
 *     ],
 *     "attachments": [...]
 *   }
 * }
 *
 * @package    api
 * @subpackage v1/assignments
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/filelib.php');
require_once($CFG->dirroot . '/mod/assign/locallib.php');

// Load API base class and exceptions
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Assignment files API endpoint class.
 *
 * Handles GET requests to retrieve files associated with an assignment.
 * Returns file metadata including intro files and intro attachments with
 * secure download URLs generated via pluginfile.php.
 */
class AssignmentFilesEndpoint extends ApiBase {
    
    /**
     * Handle GET requests to retrieve assignment files.
     *
     * Extracts assignment ID from URL path, validates user permissions,
     * retrieves files from Moodle's file storage system, and returns
     * formatted file metadata with download URLs.
     *
     * URL format: /api/v1/assignments/{id}/files
     *
     * @return void Outputs JSON response via success() method
     * @throws NotFoundException If assignment not found
     * @throws ForbiddenException If user lacks mod/assign:view capability
     * @throws ValidationException If assignment ID is invalid
     */
    protected function handle_get() {
        global $DB;
        
        // Extract assignment ID from URL path
        // Expected format: /api/v1/assignments/{id}/files
        $urlParts = explode('/', trim($this->requestUri, '/'));
        
        // Find the position of 'assignments' and get the next element as ID
        $assignmentIdIndex = array_search('assignments', $urlParts);
        if ($assignmentIdIndex === false || !isset($urlParts[$assignmentIdIndex + 1])) {
            throw new ValidationException('Assignment ID not provided in URL path', [
                'expectedFormat' => '/api/v1/assignments/{id}/files',
                'receivedUri' => $this->requestUri
            ]);
        }
        
        // Get and validate assignment ID
        $assignmentId = $urlParts[$assignmentIdIndex + 1];
        
        // Validate that ID is a positive integer
        if (!ctype_digit($assignmentId) || intval($assignmentId) <= 0) {
            throw new ValidationException('Invalid assignment ID format', [
                'assignmentId' => $assignmentId,
                'expected' => 'positive integer',
                'reason' => 'Assignment ID must be a positive integer'
            ]);
        }
        
        $assignmentId = intval($assignmentId);
        
        // Get course module by assignment ID
        // First, get the assignment instance to find the course module
        $assignment = $DB->get_record('assign', ['id' => $assignmentId], '*', MUST_EXIST);
        if (!$assignment) {
            throw new NotFoundException('Assignment not found', [
                'assignmentId' => $assignmentId,
                'reason' => 'No assignment exists with this ID'
            ]);
        }
        
        // Get the course module from the assignment's course and instance
        $cm = get_coursemodule_from_instance('assign', $assignmentId, $assignment->course, false, MUST_EXIST);
        if (!$cm) {
            throw new NotFoundException('Course module not found for assignment', [
                'assignmentId' => $assignmentId,
                'courseId' => $assignment->course,
                'reason' => 'Assignment exists but course module not found'
            ]);
        }
        
        // Get module context
        $context = context_module::instance($cm->id);
        
        // Check user capability to view the assignment
        $this->checkCapability('mod/assign:view', $context);
        
        // Get course for assign class instantiation
        $course = $DB->get_record('course', ['id' => $assignment->course], '*', MUST_EXIST);
        
        // Instantiate assign class to access assignment functionality
        $assignInstance = new assign($context, $cm, $course);
        
        // Get the assignment instance data
        $assignmentData = $assignInstance->get_instance();
        
        // Get file storage instance
        $fs = get_file_storage();
        
        // Retrieve intro files from 'intro' file area
        // Parameters: contextid, component, filearea, itemid, sort, includedirs
        // We exclude directories by passing false for includedirs
        $introFiles = $fs->get_area_files(
            $context->id,
            'mod_assign',
            'intro',
            0,
            'filename',
            false  // Exclude directories
        );
        
        // Retrieve intro attachment files from 'introattachment' file area
        $introAttachmentFiles = $fs->get_area_files(
            $context->id,
            'mod_assign',
            'introattachment',
            0,
            'filename',
            false  // Exclude directories
        );
        
        // Format intro files into array of metadata
        $introFilesData = [];
        foreach ($introFiles as $file) {
            $introFilesData[] = $this->formatFileMetadata($file, $context, 'intro');
        }
        
        // Format intro attachment files into array of metadata
        $attachmentFilesData = [];
        foreach ($introAttachmentFiles as $file) {
            $attachmentFilesData[] = $this->formatFileMetadata($file, $context, 'introattachment');
        }
        
        // Prepare response data structure
        $responseData = [
            'assignmentId' => $assignmentId,
            'intro' => $introFilesData,
            'attachments' => $attachmentFilesData,
            'totalFiles' => count($introFilesData) + count($attachmentFilesData)
        ];
        
        // Return success response
        $this->success($responseData);
    }
    
    /**
     * Format file metadata for API response.
     *
     * Extracts relevant metadata from a stored_file object and generates
     * a secure download URL via moodle_url::make_pluginfile_url().
     *
     * @param stored_file $file     Moodle stored_file object
     * @param context     $context  Module context for URL generation
     * @param string      $filearea File area name ('intro' or 'introattachment')
     * @return array Formatted file metadata array
     */
    private function formatFileMetadata($file, $context, $filearea) {
        global $CFG;
        
        // Extract file metadata using stored_file methods
        $fileData = [
            'id' => $file->get_contenthash(),
            'filename' => $file->get_filename(),
            'filesize' => $file->get_filesize(),
            'mimetype' => $file->get_mimetype(),
            'timemodified' => $file->get_timemodified(),
            'filepath' => $file->get_filepath()
        ];
        
        // Generate secure download URL using moodle_url::make_pluginfile_url()
        // Parameters: contextid, component, filearea, itemid, filepath, filename, forcedownload, options
        $downloadUrl = moodle_url::make_pluginfile_url(
            $context->id,           // Context ID
            'mod_assign',           // Component name
            $filearea,              // File area ('intro' or 'introattachment')
            $file->get_itemid(),    // Item ID (usually 0 for intro files)
            $file->get_filepath(),  // File path within area
            $file->get_filename(),  // Filename
            false                   // Force download (false = open in browser if possible)
        );
        
        // Convert moodle_url object to string
        $fileData['url'] = $downloadUrl->out(false);
        
        return $fileData;
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for assignment files endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/assignments/{id}/files'
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for assignment files endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/assignments/{id}/files'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for assignment files endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/assignments/{id}/files'
        ]);
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new AssignmentFilesEndpoint();
    $endpoint->execute();
}
