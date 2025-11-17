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
 * REST API endpoint for file listing
 *
 * GET /api/v1/files
 * Returns hierarchical file and directory information for a given context,
 * component, and file area with support for filtering by modification time
 * for incremental synchronization.
 *
 * @package    core_files
 * @category   api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/lib/filelib.php');
require_once($CFG->dirroot . '/api/lib/api_base.php');
require_once($CFG->dirroot . '/api/lib/api_response.php');
require_once($CFG->dirroot . '/api/lib/api_exception.php');

/**
 * File listing API endpoint class
 *
 * Extends ApiBase to provide JWT authentication, parameter validation,
 * and error handling for file browsing operations. Uses existing Moodle
 * file browser (get_file_browser()) to access file metadata including
 * permissions, timestamps, file sizes, and author information.
 *
 * @package    core_files
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class FilesListEndpoint extends ApiBase {

    /**
     * Handle GET request for file listing
     *
     * Retrieves file and directory information from Moodle's file storage system
     * for a given context, component, and file area. Returns structured JSON
     * with parent breadcrumb trail and children file/folder list.
     *
     * Query Parameters:
     * - contextid (int, required): Context ID for file location
     * - component (string, optional): Component name (e.g., 'mod_assign', 'course')
     * - filearea (string, optional): File area name (e.g., 'submission', 'intro')
     * - itemid (int, optional): Item ID associated with files
     * - filepath (string, optional): Path within file area (e.g., '/', '/folder/')
     * - filename (string, optional): Specific filename to retrieve
     * - modified (int, optional): Unix timestamp to filter files modified after this time
     * - page (int, optional): Page number for pagination (default: 1)
     * - perPage (int, optional): Items per page (default: 20, max: 100)
     *
     * @return void Outputs JSON response
     * @throws ValidationException If parameters are invalid
     * @throws ForbiddenException If user lacks permissions
     * @throws NotFoundException If file_info not found
     */
    protected function handle_get() {
        global $CFG;

        // Extract and validate query parameters
        $contextid = $this->getParam('contextid', PARAM_INT, true);
        $component = $this->getParam('component', PARAM_COMPONENT, false);
        $filearea = $this->getParam('filearea', PARAM_AREA, false);
        $itemid = $this->getParam('itemid', PARAM_INT, false);
        $filepath = $this->getParam('filepath', PARAM_PATH, false);
        $filename = $this->getParam('filename', PARAM_FILE, false);
        $modified = $this->getParam('modified', PARAM_INT, false);
        $page = $this->getParam('page', PARAM_INT, false, 1);
        $perPage = $this->getParam('perPage', PARAM_INT, false, 20);

        // Validate pagination parameters
        if ($page < 1) {
            throw new ValidationException('Page parameter must be greater than 0');
        }
        if ($perPage < 1 || $perPage > 100) {
            throw new ValidationException('Per page parameter must be between 1 and 100');
        }

        // Validate contextid is provided
        if (empty($contextid)) {
            throw new ValidationException('Context ID is required');
        }

        // Convert empty strings to null for optional parameters (Moodle pattern)
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
        if (empty($itemid)) {
            $itemid = 0;  // Default itemid to 0 if not provided
        }

        // Get context from contextid
        try {
            $context = context::instance_by_id($contextid);
        } catch (Exception $e) {
            throw new NotFoundException('Invalid context ID: ' . $e->getMessage());
        }

        // Check file access permissions - context-appropriate capability
        // For course contexts, check course:managefiles
        // For system/user contexts, check appropriate capabilities
        if ($context->contextlevel == CONTEXT_COURSE) {
            $this->checkCapability('moodle/course:managefiles', $context);
        } else if ($context->contextlevel == CONTEXT_USER) {
            // Users can access their own files
            $user = $this->getUser();
            if ($context->instanceid != $user->id) {
                $this->checkCapability('moodle/user:manageownfiles', $context);
            }
        } else if ($context->contextlevel == CONTEXT_MODULE) {
            // For module contexts, check general file access capability
            $this->checkCapability('moodle/course:managefiles', $context);
        } else {
            // For system and other contexts, check system-level capability
            $this->checkCapability('moodle/site:config', $context);
        }

        // Get file browser instance
        $browser = get_file_browser();

        // Get file info from browser
        $fileinfo = $browser->get_file_info(
            $context,
            $component,
            $filearea,
            $itemid,
            $filepath,
            $filename
        );

        // If file_info not found, return error
        if (!$fileinfo) {
            throw new NotFoundException(
                'File or directory not found for the specified parameters'
            );
        }

        // Build parents breadcrumb trail
        $parents = [];
        $level = $fileinfo->get_parent();
        while ($level) {
            $params = $level->get_params();
            $params['filename'] = $level->get_visible_name();
            array_unshift($parents, $params);  // Add to beginning of array
            $level = $level->get_parent();
        }

        // Get children files and directories
        $children = $fileinfo->get_children();
        $filelist = [];

        foreach ($children as $child) {
            $params = $child->get_params();
            $timemodified = $child->get_timemodified();
            $timecreated = $child->get_timecreated();

            // Filter by modified timestamp if provided
            if (!is_null($modified) && $timemodified <= $modified) {
                continue;  // Skip files not modified after the specified timestamp
            }

            // Build file/directory node
            if ($child->is_directory()) {
                $node = [
                    'contextid' => $params['contextid'],
                    'component' => $params['component'],
                    'filearea' => $params['filearea'],
                    'itemid' => $params['itemid'],
                    'filepath' => $params['filepath'],
                    'filename' => $child->get_visible_name(),
                    'url' => null,  // Directories don't have download URLs
                    'isdir' => true,
                    'timemodified' => $timemodified,
                    'timecreated' => $timecreated,
                    'filesize' => 0,
                    'author' => null,
                    'license' => null,
                ];
            } else {
                // Regular file
                $node = [
                    'contextid' => $params['contextid'],
                    'component' => $params['component'],
                    'filearea' => $params['filearea'],
                    'itemid' => $params['itemid'],
                    'filepath' => $params['filepath'],
                    'filename' => $child->get_visible_name(),
                    'url' => $child->get_url(),
                    'isdir' => false,
                    'timemodified' => $timemodified,
                    'timecreated' => $timecreated,
                    'filesize' => $child->get_filesize(),
                    'author' => $child->get_author(),
                    'license' => $child->get_license(),
                ];
            }

            $filelist[] = $node;
        }

        // Apply pagination to file list
        $total = count($filelist);
        $totalPages = ceil($total / $perPage);
        $offset = ($page - 1) * $perPage;
        $paginatedFiles = array_slice($filelist, $offset, $perPage);

        // Build response data
        $responseData = [
            'parents' => $parents,
            'files' => $paginatedFiles,
        ];

        // Build pagination metadata
        $paginationMeta = ApiResponse::formatPagination($page, $perPage, $total);

        // Return success response with pagination metadata
        $this->success($responseData, ['pagination' => $paginationMeta]);
    }
}

// Execute the endpoint
// Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new FilesListEndpoint();
    $endpoint->execute();
}
