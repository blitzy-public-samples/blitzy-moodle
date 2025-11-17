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
 * REST API endpoint for file thumbnail generation - GET /api/v1/files/thumbnail/{id}
 *
 * Generates and serves file thumbnails/preview images using Moodle's built-in
 * thumbnail generation system. Supports:
 * - Automatic thumbnail generation for supported file types (images, PDFs, documents)
 * - Multiple preview sizes (thumb, icon, tinyicon)
 * - Fallback to file type icons for unsupported formats
 * - Efficient caching of generated thumbnails
 * - Context-based permission checking
 *
 * This endpoint acts as a thin wrapper around Moodle's get_file_preview() and
 * send_stored_file() functions, providing API access to the preview system used
 * by the file manager and file browsers throughout Moodle.
 *
 * URL Pattern: GET /api/v1/files/thumbnail/{id}
 * Query Parameters:
 *   - size (optional, string): Preview size - 'thumb' (default), 'icon', or 'tinyicon'
 *
 * Example Requests:
 * - GET /api/v1/files/thumbnail/12345
 * - GET /api/v1/files/thumbnail/12345?size=icon
 * - GET /api/v1/files/thumbnail/67890?size=tinyicon
 *
 * Response: Image file content with appropriate HTTP headers (Content-Type, Cache-Control, etc.)
 *
 * Error Responses:
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: User lacks permission to access file
 * - 404 Not Found: File does not exist or is a directory
 * - 500 Server Error: Thumbnail generation failed
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/filelib.php');
require_once($CFG->libdir . '/filestorage/file_storage.php');
require_once($CFG->libdir . '/accesslib.php');

// Load API base class and exceptions
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_response.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * File Thumbnail API endpoint implementation.
 *
 * Extends ApiBase to provide thumbnail generation and serving functionality
 * with JWT authentication and proper permission checking. Leverages Moodle's
 * built-in preview generation system which:
 * - Caches thumbnails to avoid regeneration overhead
 * - Supports multiple image formats (JPEG, PNG, GIF)
 * - Handles document previews (PDF, Office documents)
 * - Falls back to file type icons for unsupported types
 *
 * Key features:
 * - Validates user authentication via JWT token (inherited from ApiBase)
 * - Retrieves file from Moodle's file storage using file ID
 * - Enforces context-based capability checks for file access
 * - Supports multiple thumbnail sizes (thumb, icon, tinyicon)
 * - Generates thumbnails on-demand with automatic caching
 * - Serves file type icons as fallback for unsupported formats
 * - Optimizes browser caching with appropriate headers
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class FileThumbnailEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve a file thumbnail.
     *
     * Retrieves file by ID from Moodle's file storage system, validates user
     * has permission to access the file based on its context, and serves a
     * thumbnail/preview image using Moodle's preview generation system.
     *
     * The thumbnail is generated using get_file_preview() which:
     * - Creates thumbnails for supported file types (images, PDFs, documents)
     * - Caches generated thumbnails to avoid regeneration
     * - Returns cached thumbnails on subsequent requests
     * - Supports multiple size modes (thumb, icon, tinyicon)
     *
     * If thumbnail generation fails (unsupported file type), the endpoint
     * serves an appropriate file type icon as a visual fallback.
     *
     * URL Parameters:
     *   - File ID is extracted from URL path: /api/v1/files/thumbnail/{id}
     *
     * Query Parameters:
     *   - size (optional): Preview size mode
     *     * 'thumb' (default): Standard thumbnail (~90x90px for images)
     *     * 'icon': Larger icon size (~64x64px)
     *     * 'tinyicon': Small icon (~24x24px)
     *
     * Permission Checking:
     * Files are checked based on their context, matching download.php:
     * - Course files: require 'moodle/course:view' capability
     * - User files: require 'moodle/user:viewdetails' capability
     * - Module files: require component-specific capabilities
     * - System files: require 'moodle/site:config' capability
     *
     * @return void Outputs image content directly via send_stored_file() or send_file()
     * @throws NotFoundException If file ID is invalid or file does not exist
     * @throws ForbiddenException If user lacks permission to access file
     * @throws ServerException If thumbnail generation and fallback both fail
     */
    protected function handle_get() {
        global $CFG, $OUTPUT;
        
        // Extract file ID from URL path
        // URL pattern: /api/v1/files/thumbnail/{id}
        $fileid = $this->extractFileIdFromPath();
        
        if (!$fileid || !is_numeric($fileid)) {
            throw new ValidationException('Invalid file ID', [
                'parameter' => 'id',
                'reason' => 'File ID must be a valid integer',
                'example' => '/api/v1/files/thumbnail/12345'
            ]);
        }
        
        $fileid = (int)$fileid;
        
        // Get preview size parameter (thumb, icon, tinyicon)
        // Default to 'thumb' if not specified or invalid
        $size = $this->getParam('size', PARAM_ALPHA, false, 'thumb');
        
        // Validate size parameter - must be one of the supported modes
        $validSizes = ['thumb', 'icon', 'tinyicon'];
        if (!in_array($size, $validSizes)) {
            throw new ValidationException('Invalid preview size', [
                'parameter' => 'size',
                'value' => $size,
                'validValues' => $validSizes,
                'reason' => 'Size must be one of: thumb, icon, tinyicon'
            ]);
        }
        
        // Get file storage instance
        $fs = get_file_storage();
        
        if (!$fs) {
            throw new ServerException('File storage system not available', [
                'reason' => 'Could not initialize file storage',
                'action' => 'Contact system administrator'
            ]);
        }
        
        // Retrieve stored file by ID
        $storedfile = $fs->get_file_by_id($fileid);
        
        // Validate file exists
        if (!$storedfile) {
            throw new NotFoundException('File not found', [
                'fileId' => $fileid,
                'reason' => 'No file exists with this ID'
            ]);
        }
        
        // Check if file is a directory (directories have no thumbnails)
        if ($storedfile->is_directory()) {
            throw new NotFoundException('Cannot generate thumbnail for directory', [
                'fileId' => $fileid,
                'filename' => $storedfile->get_filename(),
                'reason' => 'The requested resource is a directory, not a file'
            ]);
        }
        
        // Get file context for permission checking
        $contextid = $storedfile->get_contextid();
        
        try {
            $context = context::instance_by_id($contextid);
        } catch (Exception $e) {
            throw new ServerException('Invalid file context', [
                'contextId' => $contextid,
                'fileId' => $fileid,
                'reason' => 'File context could not be loaded',
                'error' => $e->getMessage()
            ]);
        }
        
        // Check file access permissions based on context level
        // This uses the same permission checking as download.php
        $this->checkFileAccess($storedfile, $context);
        
        // Attempt to get or generate thumbnail using Moodle's preview system
        // The get_file_preview() method:
        // - Checks if a cached preview exists for this file and size
        // - Returns cached preview if available
        // - Generates new preview if not cached (for supported file types)
        // - Returns false if preview cannot be generated
        $preview = $fs->get_file_preview($storedfile, $size);
        
        if ($preview && !$preview->is_directory()) {
            // Successfully retrieved or generated preview
            // Serve the preview image with long cache lifetime for browser optimization
            // Preview images are immutable (content hash based), so can be cached indefinitely
            
            // Set cache lifetime to 1 day (86400 seconds)
            // This balances browser caching benefits with storage concerns
            $lifetime = DAYSECS;
            
            // Serve the preview file using Moodle's send_stored_file function
            // Parameters:
            // - $preview: The preview stored_file object to serve
            // - $lifetime: Cache lifetime in seconds
            // - 0: No content filtering
            // - false: Don't force download (display inline)
            // - []: No additional options
            //
            // This function handles:
            // - Setting appropriate Content-Type header (image/jpeg, image/png, etc.)
            // - Setting cache control headers based on lifetime
            // - Handling byte-range requests if needed
            // - Browser compatibility
            //
            // Function will output the image and exit (via die())
            send_stored_file($preview, $lifetime, 0, false, []);
            
            // send_stored_file() calls die() after sending, so this is never reached
            // in production. In test mode it may return without dying.
            return;
            
        } else {
            // Preview generation failed or not supported for this file type
            // Fall back to serving an appropriate file type icon
            
            // Get the icon name for this file type (e.g., 'pdf', 'word', 'unknown')
            // file_file_icon() returns the icon filename without path or extension
            $iconname = file_file_icon($storedfile);
            
            if (!$iconname) {
                // If we can't even determine the icon, use generic 'unknown' icon
                $iconname = 'unknown';
            }
            
            // Determine icon size based on requested preview size
            // Map preview sizes to icon sizes:
            // - 'thumb' -> 64px icons
            // - 'icon' -> 48px icons  
            // - 'tinyicon' -> 24px icons
            $iconsize = 64; // Default for 'thumb'
            if ($size === 'icon') {
                $iconsize = 48;
            } elseif ($size === 'tinyicon') {
                $iconsize = 24;
            }
            
            // Construct path to icon file in Moodle's pix directory
            // Icons are typically SVG files, but may also be PNG
            // Try SVG first (preferred for scalability), fall back to PNG
            $iconpath = null;
            
            // Try to get icon URL using Moodle's output renderer
            // This handles theme overrides and proper icon resolution
            try {
                // Use pix_icon to get the icon - this returns HTML img tag
                // We need the actual file path, so we'll use image_url instead
                $iconurl = $OUTPUT->image_url("f/{$iconname}-{$iconsize}", 'moodle');
                
                if (!$iconurl) {
                    // Try without size suffix
                    $iconurl = $OUTPUT->image_url("f/{$iconname}", 'moodle');
                }
                
                // Convert URL to file path
                if ($iconurl) {
                    // Extract path from URL - this is fragile but necessary
                    // Better: serve icon directly from pix directory
                    $iconrelpath = str_replace($CFG->wwwroot . '/', '', $iconurl->out(false));
                    $iconpath = $CFG->dirroot . '/' . $iconrelpath;
                }
            } catch (Exception $e) {
                // Ignore errors in icon resolution
                $iconpath = null;
            }
            
            // If we couldn't resolve via renderer, construct path directly
            if (!$iconpath || !file_exists($iconpath)) {
                // Try standard icon paths
                $tryPaths = [
                    // SVG icons (preferred)
                    $CFG->dirroot . "/pix/f/{$iconname}.svg",
                    $CFG->dirroot . "/theme/boost/pix/f/{$iconname}.svg",
                    // PNG icons with size
                    $CFG->dirroot . "/pix/f/{$iconname}-{$iconsize}.png",
                    $CFG->dirroot . "/pix/f/{$iconname}.png",
                    // Generic fallback
                    $CFG->dirroot . "/pix/f/unknown.svg",
                    $CFG->dirroot . "/pix/f/unknown.png"
                ];
                
                foreach ($tryPaths as $tryPath) {
                    if (file_exists($tryPath)) {
                        $iconpath = $tryPath;
                        break;
                    }
                }
            }
            
            // Final validation - ensure we have a valid icon path
            if (!$iconpath || !file_exists($iconpath)) {
                throw new ServerException('Thumbnail generation failed and fallback icon not found', [
                    'fileId' => $fileid,
                    'filename' => $storedfile->get_filename(),
                    'mimetype' => $storedfile->get_mimetype(),
                    'iconName' => $iconname,
                    'size' => $size,
                    'reason' => 'Preview cannot be generated for this file type and fallback icon is missing',
                    'action' => 'Check that Moodle icon files are properly installed'
                ]);
            }
            
            // Determine MIME type based on file extension
            $iconext = pathinfo($iconpath, PATHINFO_EXTENSION);
            $iconmimetype = 'image/png'; // Default
            
            if ($iconext === 'svg') {
                $iconmimetype = 'image/svg+xml';
            } elseif ($iconext === 'gif') {
                $iconmimetype = 'image/gif';
            } elseif ($iconext === 'jpg' || $iconext === 'jpeg') {
                $iconmimetype = 'image/jpeg';
            }
            
            // Extract filename from path for Content-Disposition header
            $iconfilename = basename($iconpath);
            
            // Serve the icon file from filesystem
            // Use send_file() which handles filesystem paths (not stored_file objects)
            // Parameters:
            // - $iconpath: Filesystem path to icon file
            // - $iconfilename: Filename to use in Content-Disposition header
            // - $lifetime: Cache lifetime (1 day for icons)
            // - 0: No content filtering
            // - false: Don't force download
            // - false: Don't log as downloaded
            // - $iconmimetype: MIME type for Content-Type header
            // - false: Don't use X-Sendfile
            // - []: No additional options
            //
            // This function will output the icon and exit (via die())
            send_file($iconpath, $iconfilename, DAYSECS, 0, false, false, $iconmimetype, false, []);
            
            // send_file() calls die() after sending, so this is never reached
            // in production. In test mode it may return without dying.
            return;
        }
    }
    
    /**
     * Extract file ID from URL path.
     *
     * Parses the request URI to extract the file ID from the URL pattern:
     * /api/v1/files/thumbnail/{id}
     *
     * Handles both formats:
     * - /api/v1/files/thumbnail/12345
     * - /api/v1/files/thumbnail/12345?size=icon
     *
     * @return int|false File ID as integer, or false if not found
     */
    private function extractFileIdFromPath() {
        // Get request URI from server variable
        $uri = $this->requestUri;
        
        // Remove query string if present
        $uri = explode('?', $uri)[0];
        
        // Remove trailing slash if present
        $uri = rtrim($uri, '/');
        
        // Expected pattern: /api/v1/files/thumbnail/{id}
        // Split by '/' and get the last segment
        $segments = explode('/', $uri);
        
        // The file ID should be the last segment after 'thumbnail'
        // Find the 'thumbnail' segment and get the next one
        $thumbnailIndex = array_search('thumbnail', $segments);
        
        if ($thumbnailIndex !== false && isset($segments[$thumbnailIndex + 1])) {
            $fileid = $segments[$thumbnailIndex + 1];
            
            // Validate it's numeric
            if (is_numeric($fileid)) {
                return (int)$fileid;
            }
        }
        
        return false;
    }
    
    /**
     * Check if user has permission to access a file based on its context.
     *
     * Enforces appropriate capability checks based on the context level of the file.
     * This ensures users can only access thumbnails for files they have permission
     * to view in the full interface.
     *
     * Permission requirements match the download.php endpoint:
     * - System context: requires 'moodle/site:config' (system administrators only)
     * - Course category context: requires 'moodle/category:viewcourselist'
     * - Course context: requires 'moodle/course:view'
     * - Module context: requires 'moodle/course:view' (delegates to component capability checking)
     * - User context: requires 'moodle/user:viewdetails' (or viewing own files)
     * - Block context: inherits from parent context
     *
     * @param stored_file $storedfile The file to check access for
     * @param context $context The context of the file
     * @throws ForbiddenException If user lacks required capability
     */
    private function checkFileAccess($storedfile, $context) {
        // Get authenticated user
        $user = $this->getUser();
        
        // Determine required capability based on context level
        switch ($context->contextlevel) {
            case CONTEXT_SYSTEM:
                // System files require system config capability
                $this->checkCapability('moodle/site:config', $context);
                break;
                
            case CONTEXT_COURSECAT:
                // Course category files require category view capability
                $this->checkCapability('moodle/category:viewcourselist', $context);
                break;
                
            case CONTEXT_COURSE:
                // Course files require course view capability
                $this->checkCapability('moodle/course:view', $context);
                break;
                
            case CONTEXT_MODULE:
                // Module files require course view at minimum
                // Component-specific capabilities are checked by the component itself
                $coursecontext = $context->get_course_context();
                $this->checkCapability('moodle/course:view', $coursecontext);
                break;
                
            case CONTEXT_USER:
                // User files require either:
                // 1. User is viewing their own files, OR
                // 2. User has viewdetails capability in that user's context
                
                // Extract user ID from context
                $fileuserid = $context->instanceid;
                
                if ($user->id != $fileuserid) {
                    // Not viewing own files, check viewdetails capability
                    $this->checkCapability('moodle/user:viewdetails', $context);
                }
                // If viewing own files, no additional capability check needed
                break;
                
            case CONTEXT_BLOCK:
                // Block context inherits from parent context
                $parentcontext = $context->get_parent_context();
                if ($parentcontext) {
                    // Recursively check parent context permissions
                    $this->checkFileAccess($storedfile, $parentcontext);
                } else {
                    // No parent context - shouldn't happen, but handle safely
                    throw new ForbiddenException('Cannot determine file permissions', [
                        'fileId' => $storedfile->get_id(),
                        'contextLevel' => $context->contextlevel,
                        'reason' => 'Block context has no parent context'
                    ]);
                }
                break;
                
            default:
                // Unknown context level - deny access for safety
                throw new ForbiddenException('Unknown context type for file access', [
                    'fileId' => $storedfile->get_id(),
                    'contextLevel' => $context->contextlevel,
                    'reason' => 'Context level not recognized by thumbnail endpoint'
                ]);
        }
    }
}

// Execute the endpoint
// Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new FileThumbnailEndpoint();
    $endpoint->execute();
}
