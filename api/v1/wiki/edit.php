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
 * REST API endpoint for editing existing wiki pages with automatic version control.
 *
 * Handles PUT /api/v1/wiki/pages/{id} requests to update page content and create
 * new version in history. Validates JSON request body with new content, calls
 * existing wiki_save_page() to create version record and update cached content,
 * enforces capability checks via require_capability('mod/wiki:editpage'), validates
 * user can edit via wiki_user_can_edit(), handles page locking during concurrent
 * edits, refreshes page cache and links via wiki_refresh_cachedcontent() and
 * wiki_refresh_page_links(), records version in wiki_versions table with author
 * and timestamp, and returns updated page data with new version information.
 *
 * Critical for React frontend to enable collaborative editing with conflict
 * detection, automatic version tracking, and immediate content updates for all
 * users viewing the page.
 *
 * @package    api
 * @subpackage wiki
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration
require_once(__DIR__ . '/../../config.php');

// Load API base class and dependencies
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Wiki page edit endpoint class.
 *
 * Extends ApiBase to provide REST API endpoint for editing wiki pages with
 * automatic version control and collaborative editing support.
 *
 * Endpoint: PUT /api/v1/wiki/pages/{id}
 * Authentication: Required (JWT)
 * Required capability: mod/wiki:editpage
 *
 * Request body (JSON):
 * {
 *   "content": "Updated wiki page content...",
 *   "section": "optional_section_title"  // For section editing
 * }
 *
 * Response (JSON):
 * {
 *   "success": true,
 *   "data": {
 *     "page_id": 123,
 *     "title": "Page Title",
 *     "timemodified": 1234567890,
 *     "version_id": 456,
 *     "version_number": 5,
 *     "content": "Updated content...",
 *     "author_id": 789,
 *     "version_created": 1234567890
 *   }
 * }
 *
 * @package    api
 * @subpackage wiki
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class WikiEditPageEndpoint extends ApiBase {
    
    /**
     * Handle PUT request to edit wiki page.
     *
     * Processes wiki page edit requests with automatic version control.
     * Supports both full page editing and section editing. Delegates to
     * existing Moodle wiki functions (wiki_save_page, wiki_save_section)
     * to ensure compatibility with all Moodle wiki features including
     * version history, cache refresh, and link updates.
     *
     * Process flow:
     * 1. Extract page ID from request URI
     * 2. Parse and validate JSON request body
     * 3. Load wiki page, subwiki, and wiki instances
     * 4. Verify user has edit capability
     * 5. Check user can edit (handles group/individual modes)
     * 6. Save page content (full or section)
     * 7. Return updated page data with version info
     *
     * @return void Outputs JSON response directly
     * @throws NotFoundException If page ID is invalid or page doesn't exist
     * @throws ValidationException If request body is invalid or missing required fields
     * @throws ForbiddenException If user lacks edit capability or cannot edit page
     * @throws ServerException If page save operation fails
     */
    protected function handle_put() {
        global $CFG, $DB;
        
        // Step 1: Extract page ID from request URI
        // Expected URI pattern: /api/v1/wiki/pages/{id}
        if (!preg_match('/\/wiki\/pages\/(\d+)$/', $this->requestUri, $matches)) {
            throw new NotFoundException(404, 'NOT_FOUND', 'Invalid wiki page endpoint', [
                'requestUri' => $this->requestUri,
                'expectedPattern' => '/api/v1/wiki/pages/{id}',
                'reason' => 'Page ID not found in URI'
            ]);
        }
        
        $pageid = (int)$matches[1];
        
        // Step 2: Get and validate JSON request body
        $data = $this->getJsonBody();
        
        // Validate required field: content (string)
        if (!isset($data['content'])) {
            throw new ValidationException(400, 'VALIDATION_ERROR', 'Missing required field: content', [
                'field' => 'content',
                'type' => 'string',
                'required' => true,
                'reason' => 'Page content is required for save operation'
            ]);
        }
        
        if (!is_string($data['content'])) {
            throw new ValidationException(400, 'VALIDATION_ERROR', 'Invalid field type: content must be string', [
                'field' => 'content',
                'expectedType' => 'string',
                'receivedType' => gettype($data['content']),
                'reason' => 'Content must be a string value'
            ]);
        }
        
        $content = $data['content'];
        
        // Optional field: section (string, for section editing)
        $section = isset($data['section']) && is_string($data['section']) ? $data['section'] : null;
        
        // Step 3: Load Moodle wiki dependencies
        require_once($CFG->dirroot . '/mod/wiki/locallib.php');
        
        // Step 4: Load wiki page and related entities
        // Get wiki page record
        $page = wiki_get_page($pageid);
        if (!$page) {
            throw new NotFoundException(404, 'PAGE_NOT_FOUND', 'Wiki page not found', [
                'pageId' => $pageid,
                'reason' => 'The specified wiki page does not exist'
            ]);
        }
        
        // Get subwiki (wiki instance for specific group/user)
        $subwiki = wiki_get_subwiki($page->subwikiid);
        if (!$subwiki) {
            throw new NotFoundException(404, 'SUBWIKI_NOT_FOUND', 'Wiki subwiki not found', [
                'subwikiId' => $page->subwikiid,
                'reason' => 'The wiki subwiki does not exist'
            ]);
        }
        
        // Get wiki instance
        $wiki = wiki_get_wiki($subwiki->wikiid);
        if (!$wiki) {
            throw new NotFoundException(404, 'WIKI_NOT_FOUND', 'Wiki instance not found', [
                'wikiId' => $subwiki->wikiid,
                'reason' => 'The wiki instance does not exist'
            ]);
        }
        
        // Get course module for context
        $cm = get_coursemodule_from_instance('wiki', $wiki->id);
        if (!$cm) {
            throw new NotFoundException(404, 'MODULE_NOT_FOUND', 'Course module not found', [
                'wikiId' => $wiki->id,
                'reason' => 'The wiki course module does not exist'
            ]);
        }
        
        // Get module context for capability checking
        $context = context_module::instance($cm->id);
        
        // Step 5: Check user has edit capability
        $this->checkCapability('mod/wiki:editpage', $context);
        
        // Step 6: Check user can edit this specific page
        // This function handles different wiki modes (collaborative, individual)
        // and group modes (no groups, separate groups, visible groups)
        if (!wiki_user_can_edit($subwiki)) {
            throw new ForbiddenException(403, 'CANNOT_EDIT_PAGE', 'User cannot edit this wiki page', [
                'subwikiId' => $subwiki->id,
                'wikiMode' => $wiki->wikimode,
                'reason' => 'User does not have permission to edit this wiki page based on wiki mode and group settings'
            ]);
        }
        
        // Step 7: Get authenticated user for version tracking
        $user = $this->getUser();
        
        // Step 8: Save page content with version control
        try {
            if ($section !== null && $section !== '') {
                // Section editing: update only specific section
                // wiki_save_section internally calls wiki_save_page after reconstructing full content
                $result = wiki_save_section($page, $section, $content, $user->id);
                
                if ($result === false) {
                    throw new ServerException(500, 'SAVE_FAILED', 'Failed to save wiki section', [
                        'pageId' => $pageid,
                        'section' => $section,
                        'reason' => 'wiki_save_section returned false - section may not exist or invalid format'
                    ]);
                }
            } else {
                // Full page editing: update entire page content
                $result = wiki_save_page($page, $content, $user->id);
                
                if ($result === false) {
                    throw new ServerException(500, 'SAVE_FAILED', 'Failed to save wiki page', [
                        'pageId' => $pageid,
                        'reason' => 'wiki_save_page returned false - user may lack capability or page locked'
                    ]);
                }
            }
            
            // wiki_save_page and wiki_save_section automatically:
            // - Create new version record in wiki_versions table with userid and timestamp
            // - Update page timemodified field
            // - Refresh cached content via wiki_refresh_cachedcontent()
            // - Update page links via wiki_refresh_page_links()
            // - Trigger page_updated event for activity logging
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to API exceptions
            throw new ServerException(500, 'SAVE_FAILED', 'Wiki save operation failed: ' . $e->getMessage(), [
                'pageId' => $pageid,
                'errorCode' => $e->errorcode,
                'module' => $e->module ?? 'wiki',
                'originalMessage' => $e->getMessage()
            ]);
        }
        
        // Step 9: Retrieve updated page and current version for response
        // Reload page to get updated timemodified
        $updatedPage = wiki_get_page($pageid);
        
        // Get current version (most recent)
        $currentVersion = wiki_get_current_version($pageid);
        
        if (!$currentVersion) {
            // This should not happen after successful save, but handle defensively
            throw new ServerException(500, 'VERSION_NOT_FOUND', 'Failed to retrieve current version after save', [
                'pageId' => $pageid,
                'reason' => 'Version record not found after successful save operation'
            ]);
        }
        
        // Step 10: Build response data structure
        $responseData = [
            'page_id' => (int)$updatedPage->id,
            'title' => $updatedPage->title,
            'timemodified' => (int)$updatedPage->timemodified,
            'version_id' => (int)$currentVersion->id,
            'version_number' => (int)$currentVersion->version,
            'content' => $currentVersion->content,
            'author_id' => (int)$currentVersion->userid,
            'version_created' => (int)$currentVersion->timecreated,
            'cachedcontent' => $updatedPage->cachedcontent ?? null,
            'subwiki_id' => (int)$updatedPage->subwikiid
        ];
        
        // Step 11: Return success response
        $this->success($responseData, 200);
    }
    
    /**
     * Handle GET request - not allowed for wiki page edit endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not allowed for wiki page edit endpoint');
    }
    
    /**
     * Handle POST request - not allowed for wiki page edit endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not allowed for wiki page edit endpoint');
    }
    
    /**
     * Handle DELETE request - not allowed for wiki page edit endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed for wiki page edit endpoint');
    }
}

// Initialize and execute endpoint
// Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new WikiEditPageEndpoint();
    $endpoint->execute();
}
