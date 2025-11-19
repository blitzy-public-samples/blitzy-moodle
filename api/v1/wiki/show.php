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
 * REST API endpoint for retrieving wiki activity details.
 *
 * Handles GET /api/v1/wiki/{id} requests to return comprehensive wiki information
 * including wiki properties, configuration, collaboration mode, subwiki information,
 * first page details, and user access rights. This endpoint serves as the primary
 * data source for the React frontend wiki overview component.
 *
 * The endpoint implements the thin wrapper pattern by delegating all business logic
 * to existing Moodle wiki functions:
 * - wiki_get_wiki() for loading wiki instance
 * - get_coursemodule_from_instance() for course module context
 * - require_capability() for permission enforcement
 * - groups_get_activity_group() for group management
 * - wiki_get_subwiki_by_group() for subwiki retrieval
 * - wiki_get_first_page() for initial page access
 * - wiki_user_can_edit() for edit permission checks
 * - wiki_user_can_view() for view permission validation
 *
 * Wiki modes supported:
 * - Collaborative: Single shared wiki for all users in the course
 * - Individual: Each user has their own personal wiki instance
 * - Separate groups: One wiki per group in the course
 * - Visible groups: All users can view all group wikis
 *
 * Response includes:
 * - Wiki metadata: id, name, intro, course, timestamps
 * - Configuration: wikimode, firstpagetitle, defaultformat, forceformat
 * - Subwiki information: subwiki_id, groupid, userid (for individual mode)
 * - First page: firstpageid if wiki has been initialized
 * - Permissions: can_edit, can_view based on user role and wiki mode
 * - Context: coursemodule_id, context_id for navigation
 *
 * @package    mod_wiki
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration
require_once(__DIR__ . '/../../config.php');

// Load API base class and dependencies
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Wiki show endpoint class.
 *
 * Implements GET handler for retrieving detailed wiki information with proper
 * JWT authentication, permission checks, and comprehensive response formatting.
 *
 * URL Pattern: GET /api/v1/wiki/{id}
 * Authentication: Required (JWT token)
 * Required capability: mod/wiki:viewpage in module context
 *
 * Example response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 5,
 *     "name": "Course Collaborative Wiki",
 *     "intro": "Shared wiki for course content",
 *     "course": 12,
 *     "timecreated": 1609459200,
 *     "timemodified": 1640995200,
 *     "wikimode": "collaborative",
 *     "firstpagetitle": "Main Page",
 *     "defaultformat": "html",
 *     "forceformat": 0,
 *     "subwiki_id": 3,
 *     "groupid": 0,
 *     "firstpageid": 42,
 *     "can_edit": true,
 *     "can_view": true,
 *     "coursemodule_id": 87,
 *     "context_id": 156
 *   }
 * }
 */
class WikiShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve wiki details.
     *
     * Extracts wiki ID from URL, loads wiki and course module information,
     * enforces view capability, determines appropriate subwiki based on wiki mode
     * and user/group context, retrieves first page if available, checks edit/view
     * permissions, and returns comprehensive wiki data.
     *
     * URL Parameter: {id} - Wiki instance ID extracted from /api/v1/wiki/{id}
     *
     * @return void Outputs JSON response via $this->success()
     * @throws NotFoundException If wiki ID is invalid or wiki doesn't exist
     * @throws ForbiddenException If user lacks mod/wiki:viewpage capability or
     *                            cannot view the specific subwiki based on wiki mode
     */
    protected function handle_get() {
        global $CFG, $DB;
        
        // Extract wiki ID from request URI using regex pattern
        // Expected URI format: /api/v1/wiki/123
        if (!preg_match('/\/wiki\/(\d+)$/', $this->requestUri, $matches)) {
            throw new NotFoundException(404, 'WIKI_NOT_FOUND', 
                'Wiki ID not provided in URL', [
                    'expectedFormat' => '/api/v1/wiki/{id}',
                    'receivedUri' => $this->requestUri
                ]);
        }
        
        $wikiid = (int)$matches[1];
        
        // Load wiki module library functions
        require_once($CFG->dirroot . '/mod/wiki/lib.php');
        require_once($CFG->dirroot . '/mod/wiki/locallib.php');
        
        // Retrieve wiki instance from database
        $wiki = wiki_get_wiki($wikiid);
        
        if (!$wiki) {
            throw new NotFoundException(404, 'WIKI_NOT_FOUND', 
                "Wiki with ID {$wikiid} does not exist", [
                    'wikiId' => $wikiid
                ]);
        }
        
        // Get course module instance for this wiki
        $cm = get_coursemodule_from_instance('wiki', $wikiid);
        
        if (!$cm) {
            throw new NotFoundException(404, 'COURSEMODULE_NOT_FOUND', 
                "Course module not found for wiki {$wikiid}", [
                    'wikiId' => $wikiid
                ]);
        }
        
        // Get course record
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        
        // Get module context for capability checking
        $context = context_module::instance($cm->id);
        
        // Check if user has permission to view wiki pages
        // This enforces the base mod/wiki:viewpage capability
        $this->checkCapability('mod/wiki:viewpage', $context);
        
        // Determine current group based on wiki group mode
        // groups_get_activity_group() returns the appropriate group ID
        // considering group mode (NOGROUPS, SEPARATEGROUPS, VISIBLEGROUPS)
        $currentgroup = groups_get_activity_group($cm);
        
        // Determine user ID for subwiki access based on wiki mode
        // Individual mode: each user has their own wiki (use current user ID)
        // Collaborative mode: shared wiki for all users (use 0 for userid)
        $userid = 0;
        if ($wiki->wikimode == 'individual') {
            $userid = $this->getUser()->id;
        }
        
        // Get or identify the appropriate subwiki instance
        // Subwikis organize wiki content by group and user based on wiki mode
        $subwiki = wiki_get_subwiki_by_group($wiki->id, $currentgroup, $userid);
        
        // Verify user can view this specific subwiki based on wiki mode
        // This checks additional permissions beyond base mod/wiki:viewpage:
        // - Individual mode: only owner or users with managewiki capability
        // - Separate groups: only group members or users with accessallgroups
        // - Visible groups: all users with viewpage capability
        if ($subwiki && !wiki_user_can_view($subwiki, $wiki)) {
            throw new ForbiddenException(403, 'WIKI_VIEW_DENIED', 
                'You do not have permission to view this wiki', [
                    'wikiId' => $wikiid,
                    'wikiMode' => $wiki->wikimode,
                    'subwikiId' => $subwiki->id,
                    'groupId' => $currentgroup,
                    'userId' => $userid,
                    'reason' => 'Wiki mode or group restrictions prevent access'
                ]);
        }
        
        // Build response data structure with wiki properties
        $responseData = [
            // Core wiki instance properties
            'id' => (int)$wiki->id,
            'course' => (int)$wiki->course,
            'name' => $wiki->name,
            'intro' => $wiki->intro,
            'introformat' => (int)$wiki->introformat,
            'timecreated' => (int)$wiki->timecreated,
            'timemodified' => (int)$wiki->timemodified,
            
            // Wiki configuration settings
            'firstpagetitle' => $wiki->firstpagetitle,
            'wikimode' => $wiki->wikimode,  // 'individual' or 'collaborative'
            'defaultformat' => $wiki->defaultformat,  // 'html', 'creole', 'nwiki'
            'forceformat' => (int)$wiki->forceformat,  // Force default format?
            
            // Module context information
            'coursemodule_id' => (int)$cm->id,
            'context_id' => (int)$context->id,
            'section' => (int)$cm->section,
            'visible' => (int)$cm->visible,
            'groupmode' => (int)$cm->groupmode,  // NOGROUPS, SEPARATEGROUPS, VISIBLEGROUPS
            
            // Current viewing context
            'current_group' => $currentgroup,
        ];
        
        // Add subwiki information if it exists
        if ($subwiki) {
            $responseData['subwiki'] = [
                'id' => (int)$subwiki->id,
                'wikiid' => (int)$subwiki->wikiid,
                'groupid' => (int)$subwiki->groupid,
                'userid' => (int)$subwiki->userid,
            ];
            
            // Get first page of this subwiki if it exists
            $firstpage = wiki_get_first_page($subwiki->id);
            
            if ($firstpage) {
                $responseData['firstpage'] = [
                    'id' => (int)$firstpage->id,
                    'title' => $firstpage->title,
                    'cachedcontent' => $firstpage->cachedcontent,
                    'timecreated' => (int)$firstpage->timecreated,
                    'timemodified' => (int)$firstpage->timemodified,
                    'userid' => (int)$firstpage->userid,
                    'pageviews' => (int)$firstpage->pageviews,
                ];
            } else {
                // No first page exists yet (new wiki or needs creation)
                $responseData['firstpage'] = null;
            }
            
            // Check user permissions for this subwiki
            // wiki_user_can_edit() checks if user can edit pages in this subwiki
            // Considers wiki mode, group membership, and mod/wiki:editpage capability
            $canedit = wiki_user_can_edit($subwiki);
            
            $responseData['permissions'] = [
                'can_view' => true,  // Already verified via capability check and wiki_user_can_view()
                'can_edit' => (bool)$canedit,
            ];
            
        } else {
            // Subwiki doesn't exist yet - this is valid for new wikis
            // User may need to create the subwiki and first page
            $responseData['subwiki'] = null;
            $responseData['firstpage'] = null;
            
            // Without a subwiki, we can't determine edit permissions precisely
            // Check base capability as best estimate
            $responseData['permissions'] = [
                'can_view' => true,
                'can_edit' => has_capability('mod/wiki:editpage', $context),
            ];
        }
        
        // Add group information if wiki uses groups
        if ($cm->groupmode != NOGROUPS) {
            $groups = groups_get_activity_allowed_groups($cm);
            $responseData['groups'] = array_map(function($group) {
                return [
                    'id' => (int)$group->id,
                    'name' => $group->name,
                ];
            }, array_values($groups));
        } else {
            $responseData['groups'] = [];
        }
        
        // Add individual mode context if applicable
        if ($wiki->wikimode == 'individual') {
            $responseData['individual_mode'] = [
                'enabled' => true,
                'owner_userid' => (int)$userid,
                'description' => 'Each user has their own personal wiki',
            ];
        }
        
        // Return comprehensive wiki data via standard success response
        $this->success($responseData);
    }
    
    /**
     * Handle POST requests - not supported for wiki show endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for wiki show endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/wiki/{id}'
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for wiki show endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for wiki show endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/wiki/{id}'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for wiki show endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for wiki show endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/wiki/{id}'
        ]);
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new WikiShowEndpoint();
    $endpoint->execute();
}
