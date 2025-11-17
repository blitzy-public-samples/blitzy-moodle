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
 * REST API endpoint for retrieving complete version history of a wiki page.
 *
 * This endpoint handles GET /api/v1/wiki/pages/{id}/history requests to return
 * a paginated list of all versions with author information, timestamps, and
 * content changes. Critical for React frontend to display version timeline,
 * enable version comparison, support rollback functionality, and show
 * collaborative editing history with contributor attribution.
 *
 * Features:
 * - Paginated version history retrieval via wiki_get_wiki_page_versions()
 * - Author information enrichment with user records
 * - Capability checking for 'mod/wiki:viewpage' permission
 * - Content size tracking for each version
 * - Comprehensive version metadata (timestamps, format, user details)
 * - Standard pagination metadata for React frontend navigation
 *
 * Security:
 * - JWT authentication required (inherited from ApiBase)
 * - Capability check: 'mod/wiki:viewpage' in module context
 * - User visibility check via wiki_user_can_view()
 * - Validates page and subwiki existence before access
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "page_id": 123,
 *     "page_title": "Course Overview",
 *     "total_versions": 45,
 *     "versions": [
 *       {
 *         "version_id": 456,
 *         "version_number": 45,
 *         "content": "Latest content...",
 *         "contentformat": "html",
 *         "userid": 2,
 *         "author": {
 *           "id": 2,
 *           "firstname": "John",
 *           "lastname": "Doe",
 *           "username": "johndoe"
 *         },
 *         "timecreated": 1609459200,
 *         "contentsize": 1024
 *       }
 *     ]
 *   },
 *   "meta": {
 *     "pagination": {
 *       "page": 0,
 *       "perPage": 20,
 *       "total": 45,
 *       "totalPages": 3
 *     }
 *   }
 * }
 *
 * @package    mod_wiki
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base infrastructure
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');
require_once(__DIR__ . '/../../lib/api_response.php');

/**
 * Wiki page history endpoint class.
 *
 * Extends ApiBase to provide REST API access to wiki page version history.
 * Retrieves all versions of a wiki page with pagination support, enriched
 * with author information for collaborative editing visibility.
 *
 * @package    mod_wiki
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class WikiHistoryEndpoint extends ApiBase {
    
    /**
     * Handle GET requests for wiki page version history.
     *
     * Processes GET /api/v1/wiki/pages/{id}/history requests by:
     * 1. Extracting page ID from URI path
     * 2. Validating pagination parameters (page, perPage)
     * 3. Loading wiki page, subwiki, and wiki records
     * 4. Checking user capabilities and visibility permissions
     * 5. Retrieving version history with pagination
     * 6. Enriching versions with author information
     * 7. Returning formatted response with pagination metadata
     *
     * Query Parameters:
     * - page (int, optional): Zero-based page number (default: 0)
     * - perPage (int, optional): Items per page (default: 20, max: 100)
     *
     * @return void Outputs JSON response via success() method
     * @throws NotFoundException If page ID not found in URI or page doesn't exist
     * @throws ForbiddenException If user lacks viewpage capability or visibility
     */
    protected function handle_get() {
        global $CFG, $DB;
        
        // Extract page ID from URI using regex pattern
        // Expected format: /api/v1/wiki/pages/{pageid}/history
        if (!preg_match('/\/wiki\/pages\/(\d+)\/history$/', $this->requestUri, $matches)) {
            throw new NotFoundException('Invalid URI format: page ID not found', [
                'expectedFormat' => '/api/v1/wiki/pages/{id}/history',
                'receivedUri' => $this->requestUri,
                'hint' => 'Ensure the page ID is a numeric value in the URI path'
            ]);
        }
        
        $pageid = (int) $matches[1];
        
        // Parse pagination parameters from query string
        $page = $this->getParam('page', PARAM_INT, false, 0);
        $perPage = $this->getParam('perPage', PARAM_INT, false, 20);
        
        // Validate pagination bounds
        if ($page < 0) {
            $page = 0;
        }
        
        if ($perPage < 1) {
            $perPage = 20;
        }
        
        if ($perPage > 100) {
            $perPage = 100; // Cap at 100 to prevent performance issues
        }
        
        // Load Moodle wiki dependencies
        require_once($CFG->dirroot . '/mod/wiki/locallib.php');
        
        // Get wiki page record
        $page_record = wiki_get_page($pageid);
        
        if (!$page_record) {
            throw new NotFoundException('Wiki page not found', [
                'pageId' => $pageid,
                'hint' => 'The requested wiki page does not exist or has been deleted'
            ]);
        }
        
        // Get subwiki record
        $subwiki = wiki_get_subwiki($page_record->subwikiid);
        
        if (!$subwiki) {
            throw new NotFoundException('Wiki subwiki not found', [
                'subwikiId' => $page_record->subwikiid,
                'pageId' => $pageid,
                'hint' => 'The wiki subwiki associated with this page does not exist'
            ]);
        }
        
        // Get wiki record
        $wiki = wiki_get_wiki($subwiki->wikiid);
        
        if (!$wiki) {
            throw new NotFoundException('Wiki instance not found', [
                'wikiId' => $subwiki->wikiid,
                'subwikiId' => $subwiki->id,
                'pageId' => $pageid,
                'hint' => 'The wiki activity associated with this page does not exist'
            ]);
        }
        
        // Get course module for context and capability checking
        $cm = get_coursemodule_from_instance('wiki', $wiki->id);
        
        if (!$cm) {
            throw new NotFoundException('Course module not found', [
                'wikiId' => $wiki->id,
                'hint' => 'The wiki activity is not properly configured in the course'
            ]);
        }
        
        // Check user capability to view wiki pages
        $context = context_module::instance($cm->id);
        $this->checkCapability('mod/wiki:viewpage', $context);
        
        // Additional visibility check using wiki-specific function
        if (!wiki_user_can_view($subwiki, $wiki)) {
            throw new ForbiddenException('You do not have permission to view this wiki page', [
                'wikiId' => $wiki->id,
                'subwikiId' => $subwiki->id,
                'pageId' => $pageid,
                'userId' => $this->getUser()->id,
                'reason' => 'Wiki visibility rules prevent access to this page'
            ]);
        }
        
        // Get total version count for pagination
        $totalVersions = wiki_count_wiki_page_versions($pageid);
        
        // Calculate pagination offset and limit
        $limitFrom = $page * $perPage;
        $limitNum = $perPage;
        
        // Retrieve versions ordered by version DESC (newest first)
        $versions = wiki_get_wiki_page_versions($pageid, $limitFrom, $limitNum);
        
        // Format versions array with enriched author information
        $formattedVersions = [];
        
        if ($versions) {
            foreach ($versions as $version) {
                // Get user record for author information
                $user = $DB->get_record('user', ['id' => $version->userid], 
                    'id, firstname, lastname, username, email');
                
                // Build author object (protect email privacy)
                $authorData = null;
                if ($user) {
                    $authorData = [
                        'id' => (int) $user->id,
                        'firstname' => $user->firstname,
                        'lastname' => $user->lastname,
                        'username' => $user->username,
                        // Only include email if user has permission to view it
                        // For now, exclude to maintain privacy
                    ];
                }
                
                // Build version object with all relevant data
                $formattedVersions[] = [
                    'version_id' => (int) $version->id,
                    'version_number' => (int) $version->version,
                    'content' => $version->content,
                    'contentformat' => $version->contentformat,
                    'userid' => (int) $version->userid,
                    'author' => $authorData,
                    'timecreated' => (int) $version->timecreated,
                    'contentsize' => strlen($version->content),
                ];
            }
        }
        
        // Build response data structure
        $responseData = [
            'page_id' => (int) $pageid,
            'page_title' => $page_record->title,
            'total_versions' => (int) $totalVersions,
            'versions' => $formattedVersions,
        ];
        
        // Format pagination metadata using ApiResponse helper
        $paginationMeta = [
            'pagination' => ApiResponse::formatPagination($page, $perPage, $totalVersions)
        ];
        
        // Return success response with data and pagination metadata
        $this->success($responseData, 200, $paginationMeta);
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for wiki history endpoint', [
            'supportedMethods' => ['GET'],
            'hint' => 'Use GET to retrieve version history'
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for wiki history endpoint', [
            'supportedMethods' => ['GET'],
            'hint' => 'Use GET to retrieve version history'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for wiki history endpoint', [
            'supportedMethods' => ['GET'],
            'hint' => 'Use GET to retrieve version history'
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new WikiHistoryEndpoint();
$endpoint->execute();
