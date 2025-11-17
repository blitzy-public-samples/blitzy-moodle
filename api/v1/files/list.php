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
 * REST API endpoint for file listing.
 *
 * Implements GET /api/v1/files for retrieving hierarchical file and directory
 * information from Moodle's file storage system. Returns file metadata including
 * permissions, timestamps, sizes, and author information. Supports filtering by
 * modification time for incremental synchronization and pagination for large
 * file listings.
 *
 * This endpoint wraps Moodle's get_file_browser() and file_info API to provide
 * JSON-formatted file listings with parent breadcrumb trails and children
 * file/folder lists compatible with React frontend file browser components.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include required dependencies
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/moodlelib.php');
require_once($CFG->dirroot . '/lib/filelib.php');
require_once($CFG->dirroot . '/api/lib/api_base.php');
require_once($CFG->dirroot . '/api/lib/api_response.php');
require_once($CFG->dirroot . '/api/lib/api_exception.php');

/**
 * File listing API endpoint.
 *
 * Retrieves file and directory listings from Moodle's file storage with support
 * for context-based filtering, incremental synchronization via modification time,
 * and pagination for large result sets.
 *
 * Query Parameters:
 * - contextid (int, required): Context ID for file location
 * - component (string, optional): Component name (e.g., 'mod_assign', 'course')
 * - filearea (string, optional): File area name (e.g., 'submission', 'intro')
 * - itemid (int, optional): Item ID associated with the file area
 * - filepath (string, optional): Directory path within the file area
 * - filename (string, optional): Specific filename to retrieve
 * - modified (int, optional): Unix timestamp for incremental sync (returns only files modified after this time)
 * - page (int, optional): Page number for pagination (default: 1)
 * - perPage (int, optional): Results per page (default: 50, max: 200)
 *
 * Response Structure:
 * {
 *   "success": true,
 *   "data": {
 *     "parents": [
 *       {
 *         "contextid": 123,
 *         "component": "course",
 *         "filearea": "legacy",
 *         "itemid": 0,
 *         "filepath": "/",
 *         "filename": "Files"
 *       }
 *     ],
 *     "files": [
 *       {
 *         "contextid": 123,
 *         "component": "mod_assign",
 *         "filearea": "submission",
 *         "itemid": 456,
 *         "filepath": "/submissions/",
 *         "filename": "document.pdf",
 *         "url": "https://moodle.example.com/pluginfile.php/...",
 *         "isdir": false,
 *         "timemodified": 1234567890,
 *         "timecreated": 1234567800,
 *         "filesize": 102400,
 *         "author": "John Doe",
 *         "license": "allrightsreserved"
 *       }
 *     ]
 *   },
 *   "meta": {
 *     "pagination": {
 *       "page": 1,
 *       "perPage": 50,
 *       "total": 150,
 *       "totalPages": 3
 *     }
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid parameters (ValidationException)
 * - 403 Forbidden: No permission to access files (ForbiddenException)
 * - 404 Not Found: File location does not exist (NotFoundException)
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class FileListEndpoint extends ApiBase {

    /**
     * Handle GET request for file listing.
     *
     * Processes the file listing request by:
     * 1. Validating and extracting query parameters
     * 2. Resolving context from contextid
     * 3. Checking file access permissions
     * 4. Retrieving file browser and file information
     * 5. Building parent breadcrumb trail
     * 6. Extracting metadata for children files/folders
     * 7. Filtering by modification time if specified
     * 8. Paginating results if necessary
     * 9. Returning formatted JSON response
     *
     * @return void Outputs JSON response via ApiResponse
     * @throws ValidationException If required parameters are missing or invalid
     * @throws NotFoundException If file location does not exist
     * @throws ForbiddenException If user lacks permission to access files
     */
    protected function handle_get() {
        global $DB;

        // Extract and validate query parameters
        $contextid = $this->getParam('contextid', PARAM_INT, true);
        $component = $this->getParam('component', PARAM_COMPONENT, false);
        $filearea = $this->getParam('filearea', PARAM_AREA, false);
        $itemid = $this->getParam('itemid', PARAM_INT, false);
        $filepath = $this->getParam('filepath', PARAM_PATH, false);
        $filename = $this->getParam('filename', PARAM_FILE, false);
        $modified = $this->getParam('modified', PARAM_INT, false);
        $page = $this->getParam('page', PARAM_INT, false) ?: 1;
        $perPage = $this->getParam('perPage', PARAM_INT, false) ?: 50;

        // Validate pagination parameters
        if ($page < 1) {
            throw new ValidationException('Page number must be greater than 0', [
                'field' => 'page',
                'value' => $page,
                'rule' => 'Must be a positive integer'
            ]);
        }

        if ($perPage < 1 || $perPage > 200) {
            throw new ValidationException('Results per page must be between 1 and 200', [
                'field' => 'perPage',
                'value' => $perPage,
                'rule' => 'Must be between 1 and 200'
            ]);
        }

        // Validate contextid is provided
        if (empty($contextid)) {
            throw new ValidationException('Context ID is required', [
                'field' => 'contextid',
                'rule' => 'Cannot be empty'
            ]);
        }

        // Resolve context from contextid
        try {
            $context = context::instance_by_id($contextid);
        } catch (dml_missing_record_exception $e) {
            throw new NotFoundException('Context not found', [
                'contextid' => $contextid
            ]);
        } catch (Exception $e) {
            throw new ValidationException('Invalid context ID', [
                'contextid' => $contextid,
                'error' => $e->getMessage()
            ]);
        }

        // Normalize empty string parameters to null for Moodle file browser API
        if (empty($component)) {
            $component = null;
        }
        if (empty($filearea)) {
            $filearea = null;
        }
        if (empty($filepath)) {
            $filepath = null;
        }
        if (empty($filename)) {
            $filename = null;
        }

        // Check file access permissions based on context
        // Different contexts require different capabilities
        $this->checkFileAccessCapability($context);

        // Get file browser instance (uses existing Moodle function)
        $browser = get_file_browser();

        // Get file information for the requested location
        $file_info = $browser->get_file_info(
            $context,
            $component,
            $filearea,
            $itemid,
            $filepath,
            $filename
        );

        // Throw 404 if file location doesn't exist
        if (!$file_info) {
            throw new NotFoundException('File location not found', [
                'contextid' => $contextid,
                'component' => $component,
                'filearea' => $filearea,
                'itemid' => $itemid,
                'filepath' => $filepath,
                'filename' => $filename
            ]);
        }

        // Build parent breadcrumb trail by traversing up the hierarchy
        $parents = [];
        $level = $file_info->get_parent();
        while ($level) {
            $params = $level->get_params();
            $params['filename'] = $level->get_visible_name();
            array_unshift($parents, $params);
            $level = $level->get_parent();
        }

        // Get children files and folders
        $children = $file_info->get_children();
        $files = [];

        if ($children) {
            foreach ($children as $child) {
                $params = $child->get_params();
                $timemodified = $child->get_timemodified();
                $timecreated = $child->get_timecreated();

                // Filter by modification time if specified (for incremental sync)
                if (!is_null($modified) && $timemodified <= $modified) {
                    continue;
                }

                // Build file/folder metadata structure
                if ($child->is_directory()) {
                    // Directory entry
                    $node = [
                        'contextid' => $params['contextid'],
                        'component' => $params['component'],
                        'filearea' => $params['filearea'],
                        'itemid' => $params['itemid'],
                        'filepath' => $params['filepath'],
                        'filename' => $child->get_visible_name(),
                        'url' => null,
                        'isdir' => true,
                        'timemodified' => $timemodified,
                        'timecreated' => $timecreated,
                        'filesize' => 0,
                        'author' => null,
                        'license' => null
                    ];
                } else {
                    // File entry with full metadata
                    $node = [
                        'contextid' => $params['contextid'],
                        'component' => $params['component'],
                        'filearea' => $params['filearea'],
                        'itemid' => $params['itemid'],
                        'filepath' => $params['filepath'],
                        'filename' => $child->get_visible_name(),
                        'url' => $child->get_url() ? $child->get_url()->out() : null,
                        'isdir' => false,
                        'timemodified' => $timemodified,
                        'timecreated' => $timecreated,
                        'filesize' => $child->get_filesize(),
                        'author' => $child->get_author(),
                        'license' => $child->get_license()
                    ];
                }

                $files[] = $node;
            }
        }

        // Sort files by name for consistent ordering
        usort($files, function($a, $b) {
            // Directories first, then files
            if ($a['isdir'] !== $b['isdir']) {
                return $b['isdir'] ? 1 : -1;
            }
            return strcasecmp($a['filename'], $b['filename']);
        });

        // Apply pagination
        $totalFiles = count($files);
        $totalPages = ceil($totalFiles / $perPage);
        $offset = ($page - 1) * $perPage;
        $paginatedFiles = array_slice($files, $offset, $perPage);

        // Build response data structure
        $responseData = [
            'parents' => $parents,
            'files' => $paginatedFiles
        ];

        // Add pagination metadata if results were paginated
        $meta = null;
        if ($totalFiles > 0) {
            $meta = [
                'pagination' => ApiResponse::formatPagination($page, $perPage, $totalFiles)
            ];
        }

        // Return success response with standard envelope
        $this->success($responseData, $meta);
    }

    /**
     * Check file access capability based on context type.
     *
     * Different context types require different capabilities for file access.
     * This method determines the appropriate capability and checks if the user
     * has permission to access files in the given context.
     *
     * @param context $context The context to check permissions for
     * @return void
     * @throws ForbiddenException If user lacks required capability
     */
    private function checkFileAccessCapability($context) {
        // Determine required capability based on context level
        switch ($context->contextlevel) {
            case CONTEXT_SYSTEM:
                // System-wide file access (typically admins only)
                $capability = 'moodle/site:config';
                break;
            
            case CONTEXT_COURSECAT:
                // Category file access
                $capability = 'moodle/category:manage';
                break;
            
            case CONTEXT_COURSE:
                // Course file access - check if user can manage files
                // If not, check if they can at least view the course
                if (has_capability('moodle/course:managefiles', $context)) {
                    $capability = 'moodle/course:managefiles';
                } else {
                    $capability = 'moodle/course:view';
                }
                break;
            
            case CONTEXT_MODULE:
                // Activity module file access
                $capability = 'moodle/course:view';
                break;
            
            case CONTEXT_USER:
                // User file access - check if accessing own files or has user:viewdetails
                $user = $this->getUser();
                $contextuser = $context->instanceid;
                
                if ($user->id == $contextuser) {
                    // User accessing their own files - always allowed
                    return;
                } else {
                    $capability = 'moodle/user:viewdetails';
                }
                break;
            
            default:
                // For other context levels, require basic course view capability
                $capability = 'moodle/course:view';
                break;
        }

        // Check the determined capability
        $this->checkCapability($capability, $context);
    }
}

// Execute the endpoint
$endpoint = new FileListEndpoint();
$endpoint->execute();
