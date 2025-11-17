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
 * REST API endpoint for file repository browser.
 *
 * Implements GET /api/v1/files/repository for browsing Moodle's file repository
 * system including internal storage and external repository plugins (Google Drive,
 * Dropbox, OneDrive, etc.). Provides hierarchical file system navigation, search
 * capabilities, and access to configured repositories.
 *
 * This endpoint enables the React frontend file picker to:
 * - Browse files in hierarchical folder structure
 * - Navigate parent-child relationships with breadcrumbs
 * - Search files across accessible repositories
 * - Access multiple storage backends (internal + external plugins)
 * - Select files for upload dialogs, content editors, and resource managers
 *
 * Query parameters:
 * - contextid (int, required): Context ID for permission checking
 * - component (string, optional): Component name (e.g., 'course', 'user', 'mod_assign')
 * - filearea (string, optional): File area name (e.g., 'legacy', 'draft', 'submissions')
 * - itemid (int, optional): Item ID for specific file areas
 * - filepath (string, optional): Current file path (default: '/')
 * - action (string, optional): Action to perform ('browse' or 'search', default: 'browse')
 * - search_text (string, optional): Search query text (required for search action)
 *
 * Response structure:
 * {
 *   "success": true,
 *   "data": {
 *     "current": {
 *       "contextid": 5,
 *       "component": "course",
 *       "filearea": "legacy",
 *       "itemid": 0,
 *       "filepath": "/images/",
 *       "filename": "",
 *       "isdir": true
 *     },
 *     "parents": [
 *       {"filepath": "/", "name": "Root"},
 *       {"filepath": "/images/", "name": "images"}
 *     ],
 *     "children": [
 *       {
 *         "contextid": 5,
 *         "component": "course",
 *         "filearea": "legacy",
 *         "itemid": 0,
 *         "filepath": "/images/",
 *         "filename": "photo.jpg",
 *         "isdir": false,
 *         "filesize": 153600,
 *         "timemodified": 1640000000,
 *         "timecreated": 1640000000,
 *         "url": "https://moodle.site/pluginfile.php/5/course/legacy/0/images/photo.jpg",
 *         "mimetype": "image/jpeg",
 *         "thumbnail_url": "https://moodle.site/pluginfile.php/5/course/legacy/0/images/photo.jpg?preview=thumb"
 *       }
 *     ],
 *     "repositories": [
 *       {
 *         "id": 1,
 *         "name": "Server files",
 *         "type": "filesystem"
 *       },
 *       {
 *         "id": 5,
 *         "name": "Google Drive",
 *         "type": "googledrive"
 *       }
 *     ]
 *   },
 *   "meta": {}
 * }
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
require_once($CFG->dirroot . '/repository/lib.php');

// Load API base class and utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_response.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * File repository browser API endpoint.
 *
 * Extends ApiBase to provide JWT authentication, HTTP method routing,
 * parameter extraction, and response formatting for file repository browsing.
 * Uses Moodle's get_file_browser() for file system navigation and repository
 * API for accessing external storage providers.
 */
class RepositoryEndpoint extends ApiBase {
    
    /**
     * Handle GET requests for file repository browsing.
     *
     * Supports two actions:
     * 1. Browse: Hierarchical navigation of file system with parent-child relationships
     * 2. Search: Full-text search across accessible repositories
     *
     * Uses existing Moodle file browser API (get_file_browser) for file system access
     * and repository API for external storage plugins. Enforces proper permission
     * checking at context level before allowing file access.
     *
     * @return void Outputs JSON response via success() or error()
     * @throws ValidationException If parameters are invalid
     * @throws ForbiddenException If user lacks required permissions
     * @throws NotFoundException If specified path does not exist
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Extract and validate required parameters
        $contextid = $this->getParam('contextid', PARAM_INT, true);
        
        // Extract optional parameters with defaults
        $component = $this->getParam('component', PARAM_COMPONENT, false, '');
        $filearea = $this->getParam('filearea', PARAM_AREA, false, '');
        $itemid = $this->getParam('itemid', PARAM_INT, false, 0);
        $filepath = $this->getParam('filepath', PARAM_PATH, false, '/');
        $filename = $this->getParam('filename', PARAM_FILE, false, '');
        $action = $this->getParam('action', PARAM_ALPHA, false, 'browse');
        $search_text = $this->getParam('search_text', PARAM_TEXT, false, '');
        
        // Validate action parameter
        if (!in_array($action, ['browse', 'search'])) {
            throw new ValidationException('Invalid action parameter', [
                'action' => $action,
                'allowedValues' => ['browse', 'search'],
                'reason' => 'Action must be either "browse" or "search"'
            ]);
        }
        
        // Validate search_text for search action
        if ($action === 'search' && empty($search_text)) {
            throw new ValidationException('Search text is required for search action', [
                'action' => $action,
                'parameter' => 'search_text',
                'reason' => 'search_text parameter must be provided when action is "search"'
            ]);
        }
        
        // Ensure filepath starts with forward slash
        if (!empty($filepath) && substr($filepath, 0, 1) !== '/') {
            $filepath = '/' . $filepath;
        }
        
        // Resolve context from contextid
        try {
            $context = context::instance_by_id($contextid);
        } catch (Exception $e) {
            throw new NotFoundException('Context not found', [
                'contextid' => $contextid,
                'reason' => 'The specified context ID does not exist'
            ]);
        }
        
        // Check user has permission to manage files in this context
        // Use appropriate capability based on context level
        $capability = 'moodle/course:managefiles';
        if ($context->contextlevel == CONTEXT_USER) {
            // For user context, check if user is accessing their own files
            $user = $this->getUser();
            if ($context->instanceid != $user->id) {
                // Accessing another user's files requires additional capability
                $capability = 'moodle/user:manageownfiles';
            }
        } else if ($context->contextlevel == CONTEXT_SYSTEM) {
            // System context requires site-wide capability
            $capability = 'moodle/site:config';
        }
        
        // Check capability - this will throw ForbiddenException if user lacks permission
        $this->checkCapability($capability, $context);
        
        // Get file browser instance
        $browser = get_file_browser();
        
        if (!$browser) {
            throw new ServerException('File browser not available', [
                'reason' => 'get_file_browser() returned null - file system may not be properly configured'
            ]);
        }
        
        // Build response data structure
        $responseData = [
            'current' => null,
            'parents' => [],
            'children' => [],
            'repositories' => []
        ];
        
        // Handle different actions
        if ($action === 'browse') {
            // Browse action: Navigate file system hierarchically
            $responseData = $this->handleBrowseAction(
                $browser,
                $context,
                $component,
                $filearea,
                $itemid,
                $filepath,
                $filename
            );
            
        } else if ($action === 'search') {
            // Search action: Search for files matching query
            $responseData = $this->handleSearchAction(
                $context,
                $search_text,
                $component,
                $filearea
            );
        }
        
        // Add repository list to response
        $responseData['repositories'] = $this->getRepositoriesList($context);
        
        // Return successful response
        $this->success($responseData);
    }
    
    /**
     * Handle browse action - navigate file system hierarchically.
     *
     * Uses file_browser to get directory information, builds parent breadcrumb
     * trail, and retrieves children (files and subdirectories) of current location.
     *
     * @param file_browser $browser   File browser instance
     * @param context      $context   Context object
     * @param string       $component Component name
     * @param string       $filearea  File area name
     * @param int          $itemid    Item ID
     * @param string       $filepath  Current file path
     * @param string       $filename  Filename (empty for directories)
     * @return array Response data with current, parents, and children
     * @throws NotFoundException If specified path does not exist
     */
    private function handleBrowseAction($browser, $context, $component, $filearea, $itemid, $filepath, $filename) {
        // Get file info for current location
        $file_info = $browser->get_file_info($context, $component, $filearea, $itemid, $filepath, $filename);
        
        if (!$file_info) {
            throw new NotFoundException('File or directory not found', [
                'contextid' => $context->id,
                'component' => $component,
                'filearea' => $filearea,
                'itemid' => $itemid,
                'filepath' => $filepath,
                'filename' => $filename,
                'reason' => 'The specified file or directory does not exist or is not accessible'
            ]);
        }
        
        // Build current location info
        $current = $this->buildFileInfoArray($file_info);
        
        // Build breadcrumb trail (parent hierarchy)
        $parents = $this->buildParentBreadcrumbs($file_info);
        
        // Get children (files and subdirectories)
        $children = $this->getChildren($file_info);
        
        return [
            'current' => $current,
            'parents' => $parents,
            'children' => $children
        ];
    }
    
    /**
     * Handle search action - search for files matching query.
     *
     * Searches across accessible repositories and file areas, filtering
     * results based on user permissions. Returns flat list of matching files.
     *
     * @param context $context     Context object for permission checking
     * @param string  $search_text Search query text
     * @param string  $component   Optional component filter
     * @param string  $filearea    Optional file area filter
     * @return array Response data with search results
     */
    private function handleSearchAction($context, $search_text, $component = '', $filearea = '') {
        global $DB, $USER;
        
        $results = [];
        
        // Get file browser for search
        $browser = get_file_browser();
        
        // Search implementation: We'll use the file browser to search within accessible areas
        // For a production system, you might want to use Moodle's global search or implement
        // a more sophisticated search mechanism
        
        // Get all file records matching search text in filename
        // Limited to files the user has access to based on context
        $sql = "SELECT f.*, ctx.id as contextid
                FROM {files} f
                JOIN {context} ctx ON f.contextid = ctx.id
                WHERE f.filename != '.'
                  AND " . $DB->sql_like('f.filename', ':searchterm', false) . "
                  AND f.contextid = :contextid";
        
        $params = [
            'searchterm' => '%' . $DB->sql_like_escape($search_text) . '%',
            'contextid' => $context->id
        ];
        
        // Add component filter if specified
        if (!empty($component)) {
            $sql .= " AND f.component = :component";
            $params['component'] = $component;
        }
        
        // Add filearea filter if specified
        if (!empty($filearea)) {
            $sql .= " AND f.filearea = :filearea";
            $params['filearea'] = $filearea;
        }
        
        $sql .= " ORDER BY f.filename ASC
                  LIMIT 100"; // Limit results to prevent performance issues
        
        $files = $DB->get_records_sql($sql, $params);
        
        // Convert file records to response format
        foreach ($files as $file) {
            // Get file_info object for each file to check permissions and get proper URLs
            $file_info = $browser->get_file_info(
                context::instance_by_id($file->contextid),
                $file->component,
                $file->filearea,
                $file->itemid,
                $file->filepath,
                $file->filename
            );
            
            if ($file_info) {
                // Only include files that are readable by current user
                if ($file_info->is_readable()) {
                    $results[] = $this->buildFileInfoArray($file_info);
                }
            }
        }
        
        return [
            'current' => [
                'action' => 'search',
                'query' => $search_text,
                'resultCount' => count($results)
            ],
            'parents' => [],
            'children' => $results
        ];
    }
    
    /**
     * Build file info array from file_info object.
     *
     * Extracts all relevant properties from file_info object and formats
     * them for JSON response. Includes file metadata, URLs, and thumbnail URLs.
     *
     * @param file_info $file_info File info object from file browser
     * @return array Associative array with file properties
     */
    private function buildFileInfoArray($file_info) {
        global $CFG;
        
        // Extract basic file information
        $fileData = [
            'contextid' => $file_info->get_contextid(),
            'component' => $file_info->get_component(),
            'filearea' => $file_info->get_filearea(),
            'itemid' => $file_info->get_itemid(),
            'filepath' => $file_info->get_filepath(),
            'filename' => $file_info->get_visible_name(),
            'isdir' => $file_info->is_directory(),
        ];
        
        // Add file-specific properties (not applicable to directories)
        if (!$file_info->is_directory()) {
            $fileData['filesize'] = $file_info->get_filesize();
            $fileData['timemodified'] = $file_info->get_timemodified();
            $fileData['timecreated'] = $file_info->get_timecreated();
            $fileData['mimetype'] = $file_info->get_mimetype();
            
            // Get file URL if available
            $url = $file_info->get_url();
            if ($url) {
                $fileData['url'] = $url->out(false);
                
                // Generate thumbnail URL for image files
                if (file_mimetype_in_typegroup($file_info->get_mimetype(), 'web_image')) {
                    $thumburl = $file_info->get_url();
                    $thumburl->param('preview', 'thumb');
                    $fileData['thumbnail_url'] = $thumburl->out(false);
                }
            }
            
            // Get file author information if available
            $author = $file_info->get_author();
            if ($author) {
                $fileData['author'] = $author;
            }
            
            // Get file license if available
            $license = $file_info->get_license();
            if ($license) {
                $fileData['license'] = $license;
            }
        }
        
        return $fileData;
    }
    
    /**
     * Build parent breadcrumb trail for current location.
     *
     * Recursively traverses parent directories up to root, building
     * an ordered array of parent locations for breadcrumb navigation.
     *
     * @param file_info $file_info Current file info object
     * @return array Array of parent locations with filepath and name
     */
    private function buildParentBreadcrumbs($file_info) {
        $parents = [];
        
        // Traverse up the parent hierarchy
        $current = $file_info;
        while ($parent = $current->get_parent()) {
            // Prepend parent to array (so root is first, immediate parent is last)
            array_unshift($parents, [
                'filepath' => $parent->get_filepath(),
                'name' => $parent->get_visible_name(),
                'contextid' => $parent->get_contextid(),
                'component' => $parent->get_component(),
                'filearea' => $parent->get_filearea(),
                'itemid' => $parent->get_itemid()
            ]);
            
            $current = $parent;
        }
        
        return $parents;
    }
    
    /**
     * Get children (files and subdirectories) of current directory.
     *
     * Retrieves all child items from file_info object and converts
     * them to response format. Filters out non-readable items.
     *
     * @param file_info $file_info Directory file info object
     * @return array Array of child file/directory objects
     */
    private function getChildren($file_info) {
        $children = [];
        
        // Only directories have children
        if (!$file_info->is_directory()) {
            return $children;
        }
        
        // Get child files and directories
        $childItems = $file_info->get_children();
        
        if ($childItems) {
            foreach ($childItems as $child) {
                // Only include readable items
                if ($child->is_readable()) {
                    $children[] = $this->buildFileInfoArray($child);
                }
            }
        }
        
        // Sort children: directories first, then files, both alphabetically
        usort($children, function($a, $b) {
            // Directories come before files
            if ($a['isdir'] && !$b['isdir']) {
                return -1;
            }
            if (!$a['isdir'] && $b['isdir']) {
                return 1;
            }
            
            // Within same type, sort alphabetically by name
            return strcasecmp($a['filename'], $b['filename']);
        });
        
        return $children;
    }
    
    /**
     * Get list of available repositories for current user and context.
     *
     * Uses repository API to retrieve configured repositories including
     * internal storage and external plugins (Google Drive, Dropbox, etc.).
     * Filters repositories based on user permissions and context.
     *
     * @param context $context Context for permission checking
     * @return array Array of repository objects with id, name, and type
     */
    private function getRepositoriesList($context) {
        global $USER;
        
        $repositories = [];
        
        try {
            // Get repository instances for current context and user
            $repos = repository::get_instances([
                'context' => [$context],
                'currentcontext' => $context,
                'accepted_types' => '*',
                'return_types' => FILE_INTERNAL | FILE_EXTERNAL | FILE_REFERENCE
            ]);
            
            // Convert to simple array format for response
            foreach ($repos as $repo) {
                $repositories[] = [
                    'id' => $repo->id,
                    'name' => $repo->name,
                    'type' => $repo->typename,
                    'sortorder' => $repo->sortorder
                ];
            }
            
            // Sort by sortorder
            usort($repositories, function($a, $b) {
                return $a['sortorder'] - $b['sortorder'];
            });
            
        } catch (Exception $e) {
            // If repository listing fails, return empty array rather than failing entire request
            // Log error for debugging but don't expose to client
            if (defined('DEBUG_DEVELOPER') && debugging('', DEBUG_DEVELOPER)) {
                error_log('Failed to retrieve repositories: ' . $e->getMessage());
            }
        }
        
        return $repositories;
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for repository browsing', [
            'allowedMethods' => ['GET'],
            'reason' => 'This endpoint only supports GET requests for browsing repositories'
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for repository browsing', [
            'allowedMethods' => ['GET'],
            'reason' => 'This endpoint only supports GET requests for browsing repositories'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for repository browsing', [
            'allowedMethods' => ['GET'],
            'reason' => 'This endpoint only supports GET requests for browsing repositories'
        ]);
    }
}

// Execute the endpoint only if called directly
// (not when included by tests or other scripts)
if (!defined('API_TEST_MODE') && !defined('PHPUNIT_TEST')) {
    $endpoint = new RepositoryEndpoint();
    $endpoint->execute();
}
