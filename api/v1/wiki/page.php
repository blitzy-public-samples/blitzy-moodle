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
 * REST API endpoint for retrieving wiki page details.
 *
 * Handles GET /api/v1/wiki/pages/{id} requests to return comprehensive wiki page
 * information including content, metadata, version history, wiki context, user
 * permissions, and navigation data. This endpoint enables the React frontend to
 * display wiki pages with proper formatting, show current version information,
 * and provide navigation between related pages.
 *
 * The endpoint enforces wiki-specific access control through both Moodle's capability
 * system (mod/wiki:viewpage) and wiki mode restrictions (collaborative vs individual,
 * group membership). All page content and metadata are retrieved using existing
 * Moodle wiki functions to maintain consistency with PHP-rendered pages.
 *
 * Response includes:
 * - Page properties: id, title, cached content HTML, pageviews, readonly status, timestamps
 * - Version information: current version number, content, format, author, creation time
 * - Wiki context: wiki ID, name, mode (collaborative/individual)
 * - User permissions: edit capability based on wiki mode and user role
 * - Navigation data: list of all pages in the subwiki for context menu
 *
 * Usage:
 * <code>
 * GET /api/v1/wiki/pages/42
 * Authorization: Bearer <jwt_token>
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 42,
 *     "title": "Main Page",
 *     "cachedcontent": "<h1>Welcome</h1><p>Content...</p>",
 *     "pageviews": 123,
 *     "readonly": 0,
 *     "timemodified": 1640000000,
 *     "subwikiid": 5,
 *     "version": {
 *       "id": 15,
 *       "version": 3,
 *       "content": "= Welcome =\n\nContent...",
 *       "contentformat": "creole",
 *       "userid": 2,
 *       "timecreated": 1640000000
 *     },
 *     "wiki": {
 *       "id": 1,
 *       "name": "Course Wiki",
 *       "wikimode": "collaborative"
 *     },
 *     "permissions": {
 *       "can_edit": true
 *     },
 *     "navigation": {
 *       "pages": [
 *         {"id": 42, "title": "Main Page"},
 *         {"id": 43, "title": "Help"}
 *       ]
 *     }
 *   }
 * }
 * </code>
 *
 * @package    api
 * @subpackage wiki
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration
require_once(__DIR__ . '/../../../config.php');

// Load API base class and exceptions
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Wiki page detail endpoint.
 *
 * Retrieves comprehensive information about a specific wiki page including
 * content, metadata, version information, wiki context, and navigation data.
 * Enforces wiki-specific access control and capability checks.
 *
 * @package    api
 * @subpackage wiki
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class WikiPageEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve wiki page details.
     *
     * Extracts page ID from URI, loads page data, checks permissions, retrieves
     * current version, and builds comprehensive response with page properties,
     * version information, wiki context, user permissions, and navigation data.
     *
     * Implementation steps:
     * 1. Extract page ID from URI using regex pattern matching
     * 2. Load Moodle wiki dependencies and functions
     * 3. Retrieve page record from database
     * 4. Load related subwiki and wiki records
     * 5. Get course module and establish context
     * 6. Check mod/wiki:viewpage capability
     * 7. Verify wiki-specific access via wiki_user_can_view()
     * 8. Get current version content and metadata
     * 9. Build comprehensive response array
     * 10. Return formatted JSON response
     *
     * @return void Outputs JSON response via success() method
     * @throws NotFoundException If page ID cannot be extracted from URI or page not found
     * @throws ForbiddenException If user lacks permission to view the page
     */
    protected function handle_get() {
        global $CFG, $DB;
        
        // Step 1: Extract page ID from URI
        // URI pattern: /api/v1/wiki/pages/{pageid}
        if (!preg_match('/\/wiki\/pages\/(\d+)$/', $this->requestUri, $matches)) {
            throw new NotFoundException(
                404,
                'INVALID_PAGE_URI',
                'Wiki page ID not found in request URI',
                [
                    'uri' => $this->requestUri,
                    'expectedPattern' => '/api/v1/wiki/pages/{pageid}',
                    'reason' => 'URI must include numeric page ID'
                ]
            );
        }
        
        $pageid = (int)$matches[1];
        
        // Step 2: Load Moodle wiki dependencies
        require_once($CFG->dirroot . '/mod/wiki/locallib.php');
        require_once($CFG->dirroot . '/mod/wiki/lib.php');
        
        // Step 3: Retrieve page record
        $page = wiki_get_page($pageid);
        
        if (!$page) {
            throw new NotFoundException(
                404,
                'PAGE_NOT_FOUND',
                'Wiki page does not exist',
                [
                    'pageid' => $pageid,
                    'reason' => 'No wiki page found with this ID'
                ]
            );
        }
        
        // Step 4: Load related subwiki and wiki records
        $subwiki = wiki_get_subwiki($page->subwikiid);
        
        if (!$subwiki) {
            throw new NotFoundException(
                404,
                'SUBWIKI_NOT_FOUND',
                'Wiki subwiki does not exist',
                [
                    'subwikiid' => $page->subwikiid,
                    'pageid' => $pageid,
                    'reason' => 'Subwiki associated with page not found'
                ]
            );
        }
        
        $wiki = wiki_get_wiki($subwiki->wikiid);
        
        if (!$wiki) {
            throw new NotFoundException(
                404,
                'WIKI_NOT_FOUND',
                'Wiki instance does not exist',
                [
                    'wikiid' => $subwiki->wikiid,
                    'subwikiid' => $subwiki->id,
                    'pageid' => $pageid,
                    'reason' => 'Wiki instance associated with subwiki not found'
                ]
            );
        }
        
        // Step 5: Get course module and establish context
        $cm = get_coursemodule_from_instance('wiki', $wiki->id);
        
        if (!$cm) {
            throw new NotFoundException(
                404,
                'COURSEMODULE_NOT_FOUND',
                'Course module not found',
                [
                    'wikiid' => $wiki->id,
                    'reason' => 'Course module for wiki instance not found'
                ]
            );
        }
        
        $context = context_module::instance($cm->id);
        
        // Step 6: Check mod/wiki:viewpage capability
        $this->checkCapability('mod/wiki:viewpage', $context);
        
        // Step 7: Verify wiki-specific access control
        // This checks wiki mode (collaborative vs individual), group membership,
        // and additional capability requirements beyond basic viewpage permission
        if (!wiki_user_can_view($subwiki, $wiki)) {
            throw new ForbiddenException(
                403,
                'WIKI_ACCESS_DENIED',
                'You do not have permission to view this wiki page',
                [
                    'pageid' => $pageid,
                    'subwikiid' => $subwiki->id,
                    'wikiid' => $wiki->id,
                    'wikimode' => $wiki->wikimode,
                    'groupid' => $subwiki->groupid,
                    'userid' => $subwiki->userid,
                    'reason' => 'Wiki mode or group restrictions prevent access'
                ]
            );
        }
        
        // Step 8: Get current version content and metadata
        $currentVersion = wiki_get_current_version($pageid);
        
        if (!$currentVersion) {
            // Page exists but has no version (edge case - should not happen normally)
            throw new NotFoundException(
                404,
                'VERSION_NOT_FOUND',
                'Wiki page has no version data',
                [
                    'pageid' => $pageid,
                    'reason' => 'Page exists but no version history found'
                ]
            );
        }
        
        // Step 9: Build comprehensive response array
        
        // 9.1: Page properties
        $responseData = [
            'id' => (int)$page->id,
            'title' => $page->title,
            'cachedcontent' => $page->cachedcontent ?? '',
            'pageviews' => (int)($page->pageviews ?? 0),
            'readonly' => (int)($page->readonly ?? 0),
            'timemodified' => (int)$page->timemodified,
            'subwikiid' => (int)$page->subwikiid,
        ];
        
        // 9.2: Version information
        $responseData['version'] = [
            'id' => (int)$currentVersion->id,
            'version' => (int)$currentVersion->version,
            'content' => $currentVersion->content ?? '',
            'contentformat' => $currentVersion->contentformat ?? '',
            'userid' => (int)$currentVersion->userid,
            'timecreated' => (int)$currentVersion->timecreated,
        ];
        
        // 9.3: Wiki context
        $responseData['wiki'] = [
            'id' => (int)$wiki->id,
            'name' => $wiki->name,
            'wikimode' => $wiki->wikimode,
        ];
        
        // 9.4: User permissions
        // Check if user can edit this wiki page based on wiki mode and capabilities
        $canEdit = wiki_user_can_edit($subwiki);
        
        $responseData['permissions'] = [
            'can_edit' => (bool)$canEdit,
        ];
        
        // 9.5: Navigation data - get list of all pages in this subwiki
        // This enables the React frontend to build a navigation menu or page list
        $pageList = wiki_get_page_list($subwiki->id);
        
        // Format page list for response
        $navigationPages = [];
        if ($pageList) {
            foreach ($pageList as $p) {
                $navigationPages[] = [
                    'id' => (int)$p->id,
                    'title' => $p->title,
                ];
            }
        }
        
        $responseData['navigation'] = [
            'pages' => $navigationPages,
        ];
        
        // Step 10: Return formatted JSON response
        $this->success($responseData);
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * Wiki page retrieval only supports GET method. POST requests for page
     * creation or editing should use separate endpoints.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException(
            405,
            'METHOD_NOT_ALLOWED',
            'POST method is not supported for wiki page retrieval',
            [
                'allowedMethods' => ['GET'],
                'endpoint' => '/api/v1/wiki/pages/{id}',
                'reason' => 'This endpoint only supports GET for page retrieval'
            ]
        );
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * Wiki page retrieval only supports GET method. PUT requests for page
     * updates should use a separate edit endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException(
            405,
            'METHOD_NOT_ALLOWED',
            'PUT method is not supported for wiki page retrieval',
            [
                'allowedMethods' => ['GET'],
                'endpoint' => '/api/v1/wiki/pages/{id}',
                'reason' => 'This endpoint only supports GET for page retrieval'
            ]
        );
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * Wiki page retrieval only supports GET method. DELETE requests for page
     * deletion should use a separate endpoint with appropriate permissions.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(
            405,
            'METHOD_NOT_ALLOWED',
            'DELETE method is not supported for wiki page retrieval',
            [
                'allowedMethods' => ['GET'],
                'endpoint' => '/api/v1/wiki/pages/{id}',
                'reason' => 'This endpoint only supports GET for page retrieval'
            ]
        );
    }
}

// Instantiate and execute the endpoint
// Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new WikiPageEndpoint();
    $endpoint->execute();
}
