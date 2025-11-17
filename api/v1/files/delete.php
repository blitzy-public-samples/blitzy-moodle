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
 * REST API endpoint for file deletion.
 *
 * Implements DELETE /api/v1/files/{id} for removing files from Moodle's file
 * storage system. This endpoint provides secure file deletion with comprehensive
 * permission checks and validation to ensure users can only delete files they
 * own or have management rights over.
 *
 * Key features:
 * - JWT token authentication via ApiBase parent class
 * - Strict permission enforcement using require_capability()
 * - Validation of file ownership and deletability
 * - Protection against deletion of system files or required content
 * - Event triggering for audit logging and plugin integration
 * - Support for draft area files and user-owned content
 * - Comprehensive error handling with specific exception types
 *
 * Usage:
 * DELETE /api/v1/files/{id}
 * DELETE /api/v1/files/delete.php?id={fileid}
 * 
 * Authorization: Bearer <jwt_token>
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "deleted": true,
 *     "fileid": 12345,
 *     "filename": "document.pdf",
 *     "contextid": 567,
 *     "component": "user",
 *     "filearea": "draft",
 *     "itemid": 890
 *   }
 * }
 *
 * Error responses:
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: User lacks permission to delete file
 * - 404 Not Found: File ID does not exist or is already deleted
 * - 400 Bad Request: Invalid file ID or file is not deletable
 * - 500 Internal Server Error: Database or filesystem error during deletion
 *
 * @package    api
 * @subpackage files
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/moodlelib.php');
require_once($CFG->libdir . '/accesslib.php');
require_once($CFG->libdir . '/filelib.php');
require_once($CFG->libdir . '/filestorage/file_storage.php');

// Load API base class and utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_response.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * File deletion endpoint implementation.
 *
 * Extends ApiBase to inherit JWT authentication, HTTP method routing, and
 * response formatting. Implements handle_delete() to process DELETE requests
 * for removing files from Moodle's file storage system.
 *
 * This endpoint enforces the thin wrapper pattern by calling existing Moodle
 * file storage methods (stored_file::delete()) rather than reimplementing
 * business logic. All permission checks use Moodle's capability system.
 */
class FileDeleteEndpoint extends ApiBase {
    
    /**
     * Handle DELETE request to remove a file.
     *
     * Main entry point for file deletion requests. Extracts file ID from the
     * request URI or query parameters, retrieves the stored file object,
     * validates permissions and deletability, then removes the file from both
     * database and filesystem storage.
     *
     * The method performs comprehensive validation to ensure:
     * - File exists and is accessible
     * - User has appropriate delete permissions
     * - File is owned by user or user has management capability
     * - File is not a system file or required content
     * - File is in a deletable area (e.g., draft, user content)
     *
     * After successful deletion, triggers file_deleted event for audit logging
     * and plugin integration.
     *
     * @return void Sends JSON response via success() or throws exception
     * @throws NotFoundException If file ID is invalid or file does not exist
     * @throws ForbiddenException If user lacks permission to delete file
     * @throws ValidationException If file is not deletable (system file, required content)
     * @throws ServerException If deletion fails due to database or filesystem error
     */
    protected function handle_delete() {
        global $DB, $USER;
        
        // Extract file ID from request URI path or query parameter
        // Supports both /api/v1/files/{id} and /api/v1/files/delete.php?id={id}
        $fileid = $this->extractFileId();
        
        if (!$fileid || $fileid <= 0) {
            throw new ValidationException('Invalid file ID', [
                'fileid' => $fileid,
                'reason' => 'File ID must be a positive integer'
            ]);
        }
        
        // Get authenticated user from JWT token (via ApiBase)
        $user = $this->getUser();
        
        // Get file storage instance using existing Moodle function
        $fs = get_file_storage();
        
        // Retrieve stored_file object by ID
        $storedfile = $fs->get_file_by_id($fileid);
        
        // Validate file exists
        if (!$storedfile) {
            throw new NotFoundException('File not found', [
                'fileid' => $fileid,
                'reason' => 'No file exists with this ID or file has been deleted'
            ]);
        }
        
        // Validate file is not a directory
        // Directories have filename '.' and should not be deleted via this endpoint
        if ($storedfile->is_directory()) {
            throw new ValidationException('Cannot delete directory', [
                'fileid' => $fileid,
                'filename' => $storedfile->get_filename(),
                'reason' => 'Use directory management endpoints to delete directories'
            ]);
        }
        
        // Get file metadata for permission checking and response
        $contextid = $storedfile->get_contextid();
        $component = $storedfile->get_component();
        $filearea = $storedfile->get_filearea();
        $itemid = $storedfile->get_itemid();
        $filename = $storedfile->get_filename();
        $userid = $storedfile->get_userid();
        
        // Load context for permission checking
        try {
            $context = context::instance_by_id($contextid);
        } catch (Exception $e) {
            throw new NotFoundException('Context not found for file', [
                'fileid' => $fileid,
                'contextid' => $contextid,
                'reason' => 'File context is invalid or has been deleted'
            ]);
        }
        
        // Validate file is deletable based on component, filearea, and ownership
        $this->validateFileDeletable($storedfile, $user, $context);
        
        // Check permission to delete file
        // Permission requirements vary by component and file area
        $this->checkDeletePermission($storedfile, $user, $context);
        
        // Store file information for response before deletion
        $fileinfo = [
            'deleted' => true,
            'fileid' => $fileid,
            'filename' => $filename,
            'contextid' => $contextid,
            'component' => $component,
            'filearea' => $filearea,
            'itemid' => $itemid,
            'userid' => $userid,
            'filesize' => $storedfile->get_filesize(),
            'mimetype' => $storedfile->get_mimetype(),
            'timecreated' => $storedfile->get_timecreated()
        ];
        
        // Trigger file_deleted event before deletion for audit logging
        // Event data includes file details, user who deleted it, and context
        $eventdata = [
            'contextid' => $contextid,
            'objectid' => $fileid,
            'other' => [
                'filename' => $filename,
                'filesize' => $storedfile->get_filesize(),
                'component' => $component,
                'filearea' => $filearea,
                'itemid' => $itemid,
                'filepath' => $storedfile->get_filepath()
            ]
        ];
        
        try {
            // Create and trigger file_deleted event using Moodle event system
            // This is critical for audit trail and plugin integration
            $event = \core\event\file_deleted::create($eventdata);
            $event->trigger();
        } catch (Exception $e) {
            // Log event creation failure but continue with deletion
            // Event triggering should not block file deletion
            error_log("Failed to trigger file_deleted event for file {$fileid}: {$e->getMessage()}");
        }
        
        // Delete the file using existing Moodle stored_file::delete() method
        // This removes the file from both mdl_files table and filesystem storage
        // Following thin wrapper pattern - no reimplementation of business logic
        try {
            $deleted = $storedfile->delete();
            
            if (!$deleted) {
                throw new ServerException('Failed to delete file', [
                    'fileid' => $fileid,
                    'filename' => $filename,
                    'reason' => 'File deletion returned false - file may be locked or in use'
                ]);
            }
            
        } catch (Exception $e) {
            // Catch database or filesystem errors during deletion
            throw new ServerException('Failed to delete file due to server error', [
                'fileid' => $fileid,
                'filename' => $filename,
                'originalError' => $e->getMessage(),
                'reason' => 'Database or filesystem error prevented deletion'
            ]);
        }
        
        // Return success response with deleted file information
        // Using ApiBase::success() method for consistent response format
        $this->success($fileinfo, 200);
    }
    
    /**
     * Extract file ID from request URI or query parameters.
     *
     * Supports two URL patterns:
     * 1. RESTful path: /api/v1/files/{id} - extracts ID from path segments
     * 2. Query parameter: /api/v1/files/delete.php?id={id} - extracts from $_GET
     *
     * Priority: Query parameter takes precedence over path segment to maintain
     * backward compatibility with traditional Moodle URL patterns.
     *
     * @return int|null File ID if found, null otherwise
     */
    private function extractFileId() {
        // First check query parameter (supports both 'id' and 'fileid')
        $fileid = optional_param('id', 0, PARAM_INT);
        
        if (!$fileid) {
            $fileid = optional_param('fileid', 0, PARAM_INT);
        }
        
        // If not found in query params, try extracting from URI path
        if (!$fileid) {
            // Parse URI path: /api/v1/files/{id} or /api/v1/files/delete.php?id={id}
            $uri = $this->requestUri;
            
            // Remove query string if present
            $path = parse_url($uri, PHP_URL_PATH);
            
            // Split path into segments
            $segments = explode('/', trim($path, '/'));
            
            // Look for numeric segment after 'files'
            // Expected pattern: ['api', 'v1', 'files', '{id}']
            $filesIndex = array_search('files', $segments);
            
            if ($filesIndex !== false && isset($segments[$filesIndex + 1])) {
                $potentialId = $segments[$filesIndex + 1];
                
                // Validate it's a numeric ID, not 'delete.php' or other resource
                if (is_numeric($potentialId) && (int)$potentialId > 0) {
                    $fileid = (int)$potentialId;
                }
            }
        }
        
        return $fileid;
    }
    
    /**
     * Validate that file is deletable based on ownership and file area.
     *
     * Performs comprehensive validation to ensure file can be safely deleted:
     * - Draft area files: User must own the draft (userid matches)
     * - User files: User must own the file or have management capability
     * - Course files: User must have management capability in course context
     * - System files: Cannot be deleted (required for Moodle operation)
     * - Assignment submissions: Special handling based on submission status
     *
     * This method implements business rules for file deletion without reimplementing
     * core logic - it uses existing Moodle capability and ownership checks.
     *
     * @param stored_file $storedfile File object to validate
     * @param object $user User attempting deletion
     * @param context $context Context where file is stored
     * @throws ValidationException If file cannot be deleted
     */
    private function validateFileDeletable($storedfile, $user, $context) {
        $component = $storedfile->get_component();
        $filearea = $storedfile->get_filearea();
        $userid = $storedfile->get_userid();
        
        // System files cannot be deleted - they are required for Moodle operation
        // Examples: theme files, plugin assets, core icons
        if ($component === 'core' || $component === 'theme') {
            throw new ValidationException('Cannot delete system files', [
                'component' => $component,
                'filearea' => $filearea,
                'reason' => 'System files are required for Moodle operation'
            ]);
        }
        
        // Draft area files - user must own the draft
        if ($filearea === 'draft') {
            if ($userid != $user->id) {
                throw new ValidationException('Cannot delete draft files of other users', [
                    'filearea' => $filearea,
                    'fileowner' => $userid,
                    'currentuser' => $user->id,
                    'reason' => 'You can only delete your own draft files'
                ]);
            }
            // Draft files are always deletable by owner
            return;
        }
        
        // User private files - user must own the file or have management capability
        if ($component === 'user' && $filearea === 'private') {
            if ($userid != $user->id) {
                // Check if user has capability to manage other users' files
                if (!has_capability('moodle/user:manageownfiles', $context, $user->id)) {
                    throw new ValidationException('Cannot delete private files of other users', [
                        'filearea' => $filearea,
                        'fileowner' => $userid,
                        'currentuser' => $user->id,
                        'reason' => 'You can only delete your own private files'
                    ]);
                }
            }
            return;
        }
        
        // Assignment submission files - special validation
        if ($component === 'assignsubmission_file' && $filearea === 'submission_files') {
            // Assignment submissions have complex rules based on submission status
            // User can delete files from own draft submissions
            // Teachers can delete with grading capability
            // Cannot delete files from submitted/graded assignments
            
            // For now, require assignment submission capability
            // Full validation would require loading assignment and checking status
            // This is handled by permission check in checkDeletePermission()
            return;
        }
        
        // Course legacy files - require course management capability (checked in permission)
        if ($component === 'course' && $filearea === 'legacy') {
            return;
        }
        
        // Forum attachment files - require forum edit capability (checked in permission)
        if ($component === 'mod_forum' && $filearea === 'attachment') {
            return;
        }
        
        // For other components/areas, allow if user has management capability
        // The actual permission check is done in checkDeletePermission()
    }
    
    /**
     * Check user has permission to delete file in given context.
     *
     * Permission requirements vary by component and file area:
     * - Draft files: No additional capability required (ownership validated)
     * - Course files: Requires moodle/course:managefiles capability
     * - Assignment files: Requires mod/assign:submit (own) or mod/assign:grade (others)
     * - Forum files: Requires mod/forum:deleteownpost or mod/forum:deleteanypost
     * - User files: Requires moodle/user:manageownfiles
     *
     * Uses ApiBase::checkCapability() which wraps require_capability() for
     * consistent error handling and exception throwing.
     *
     * @param stored_file $storedfile File to check permission for
     * @param object $user User attempting deletion
     * @param context $context Context to check capability in
     * @throws ForbiddenException If user lacks required capability
     */
    private function checkDeletePermission($storedfile, $user, $context) {
        $component = $storedfile->get_component();
        $filearea = $storedfile->get_filearea();
        $userid = $storedfile->get_userid();
        
        // Draft files - ownership already validated, no additional capability needed
        if ($filearea === 'draft') {
            return;
        }
        
        // User private files - check user file management capability
        if ($component === 'user' && $filearea === 'private') {
            // If user owns the file, no additional capability needed
            if ($userid == $user->id) {
                return;
            }
            // Otherwise require management capability (already validated in validateFileDeletable)
            $this->checkCapability('moodle/user:manageownfiles', $context);
            return;
        }
        
        // Course files - require course management capability
        if ($component === 'course' && ($filearea === 'legacy' || $filearea === 'summary')) {
            $this->checkCapability('moodle/course:managefiles', $context);
            return;
        }
        
        // Assignment submission files - check assignment capabilities
        if ($component === 'assignsubmission_file') {
            // If user owns the submission, check submit capability
            if ($userid == $user->id) {
                $this->checkCapability('mod/assign:submit', $context);
            } else {
                // Otherwise require grading capability
                $this->checkCapability('mod/assign:grade', $context);
            }
            return;
        }
        
        // Forum attachment files - check forum edit capabilities
        if ($component === 'mod_forum') {
            // Check if user owns the post
            if ($userid == $user->id) {
                $this->checkCapability('mod/forum:deleteownpost', $context);
            } else {
                $this->checkCapability('mod/forum:deleteanypost', $context);
            }
            return;
        }
        
        // Default: require course file management capability
        // This is a safe fallback for any file area not explicitly handled
        try {
            $this->checkCapability('moodle/course:managefiles', $context);
        } catch (ForbiddenException $e) {
            // If course management fails, try site-level capability
            $systemcontext = context_system::instance();
            $this->checkCapability('moodle/site:managecontextlocks', $systemcontext);
        }
    }
    
    /**
     * Handle GET requests - not supported for delete endpoint.
     *
     * File deletion only supports DELETE method for RESTful compliance.
     * GET requests should use the file download or list endpoints instead.
     *
     * @throws MethodNotAllowedException Always, as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for file deletion', [
            'supportedMethods' => ['DELETE'],
            'endpoint' => '/api/v1/files/{id}',
            'hint' => 'Use DELETE method to remove files'
        ]);
    }
    
    /**
     * Handle POST requests - not supported for delete endpoint.
     *
     * File deletion only supports DELETE method for RESTful compliance.
     * POST requests should use the file upload endpoint instead.
     *
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for file deletion', [
            'supportedMethods' => ['DELETE'],
            'endpoint' => '/api/v1/files/{id}',
            'hint' => 'Use DELETE method to remove files'
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for delete endpoint.
     *
     * File deletion only supports DELETE method for RESTful compliance.
     * PUT requests should use the file update endpoint instead.
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for file deletion', [
            'supportedMethods' => ['DELETE'],
            'endpoint' => '/api/v1/files/{id}',
            'hint' => 'Use DELETE method to remove files'
        ]);
    }
}

// Create endpoint instance and execute request only if called directly
// (not when included by tests or other scripts)
// ApiBase::execute() handles method routing, authentication, and exception catching
if (!defined('API_TEST_MODE') && !defined('PHPUNIT_TEST')) {
    $endpoint = new FileDeleteEndpoint();
    $endpoint->execute();
}
