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
 * REST API endpoint for creating new wiki pages within a subwiki.
 *
 * Handles POST /api/v1/wiki/pages requests with page title, initial content, 
 * and format to create new collaborative wiki pages. Validates JSON request body,
 * calls existing wiki_create_page() function to create page record with initial 
 * version, enforces capability checks via require_capability('mod/wiki:editpage'),
 * validates page title uniqueness within subwiki, handles wiki format settings 
 * (creole, nwiki, html), creates initial page version record in wiki_versions 
 * table, updates wiki links and cache via existing functions, and returns newly 
 * created page data with page ID and first version information.
 *
 * Request Body:
 * {
 *   "subwikiid": 123,
 *   "title": "New Page Title",
 *   "content": "Initial page content (optional)",
 *   "format": "html" (optional, defaults to wiki's defaultformat)
 * }
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "page_id": 456,
 *     "title": "New Page Title",
 *     "subwikiid": 123,
 *     "timemodified": 1234567890,
 *     "version_id": 789,
 *     "content": "Initial page content",
 *     "format": "html"
 *   }
 * }
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration
require_once(__DIR__ . '/../../../config.php');

// Load API base class and exception handling
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Wiki page creation endpoint class.
 *
 * Extends ApiBase to provide JWT authentication, capability checking, and
 * standardized response formatting for wiki page creation operations. Delegates
 * all page creation logic to existing Moodle wiki functions to maintain business
 * logic separation and ensure consistency with PHP-rendered wiki interface.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class WikiCreatePageEndpoint extends ApiBase {
    
    /**
     * Handle POST request to create a new wiki page.
     *
     * Validates request body, checks permissions, verifies page doesn't already exist,
     * delegates to wiki_create_page() for page creation, optionally saves initial
     * content via wiki_save_page(), and returns created page data with 201 status.
     *
     * Request validation:
     * - Required: subwikiid (integer), title (non-empty string)
     * - Optional: content (string), format (creole|nwiki|html)
     *
     * Permission checks:
     * - mod/wiki:editpage capability in module context
     * - wiki_user_can_edit() for wiki-specific access rules (mode, groups)
     *
     * Validation rules:
     * - Title must be non-empty after trimming
     * - Page with same title must not exist in subwiki
     * - Format must be valid (creole, nwiki, or html)
     *
     * @return void Outputs JSON response with created page data
     * @throws ValidationException If request body is invalid or title exists
     * @throws NotFoundException If subwiki or wiki does not exist
     * @throws ForbiddenException If user lacks permission to create pages
     */
    protected function handle_post() {
        global $CFG, $DB;
        
        // Load wiki module functions
        require_once($CFG->dirroot . '/mod/wiki/locallib.php');
        
        // Get and validate JSON request body
        $data = $this->getJsonBody();
        
        // Validate required fields
        if (!isset($data['subwikiid'])) {
            throw new ValidationException('Missing required field: subwikiid', [
                'field' => 'subwikiid',
                'reason' => 'Subwiki ID is required to create a page'
            ]);
        }
        
        if (!isset($data['title'])) {
            throw new ValidationException('Missing required field: title', [
                'field' => 'title',
                'reason' => 'Page title is required to create a page'
            ]);
        }
        
        // Validate subwikiid is an integer
        $subwikiid = filter_var($data['subwikiid'], FILTER_VALIDATE_INT);
        if ($subwikiid === false) {
            throw new ValidationException('Invalid subwikiid format', [
                'field' => 'subwikiid',
                'value' => $data['subwikiid'],
                'reason' => 'Subwiki ID must be a valid integer'
            ]);
        }
        
        // Get optional fields with defaults
        $content = isset($data['content']) ? trim($data['content']) : '';
        $providedFormat = isset($data['format']) ? trim($data['format']) : null;
        
        // Trim and validate title
        $title = trim($data['title']);
        if (empty($title)) {
            throw new ValidationException('Page title cannot be empty', [
                'field' => 'title',
                'value' => $data['title'],
                'reason' => 'Title must contain at least one non-whitespace character'
            ]);
        }
        
        // Get subwiki record
        $subwiki = wiki_get_subwiki($subwikiid);
        if (!$subwiki) {
            throw new NotFoundException('Subwiki not found', [
                'subwikiid' => $subwikiid,
                'reason' => 'The specified subwiki does not exist'
            ]);
        }
        
        // Get wiki record
        $wiki = wiki_get_wiki($subwiki->wikiid);
        if (!$wiki) {
            throw new NotFoundException('Wiki not found', [
                'wikiid' => $subwiki->wikiid,
                'reason' => 'The parent wiki for this subwiki does not exist'
            ]);
        }
        
        // Get course module
        $cm = get_coursemodule_from_instance('wiki', $wiki->id);
        if (!$cm) {
            throw new NotFoundException('Course module not found', [
                'wikiid' => $wiki->id,
                'reason' => 'Course module for this wiki does not exist'
            ]);
        }
        
        // Check mod/wiki:editpage capability
        $context = context_module::instance($cm->id);
        $this->checkCapability('mod/wiki:editpage', $context);
        
        // Check wiki-specific edit permissions (mode, groups, etc.)
        if (!wiki_user_can_edit($subwiki)) {
            throw new ForbiddenException('You do not have permission to create pages in this wiki', [
                'subwikiid' => $subwikiid,
                'wikimode' => $wiki->wikimode,
                'reason' => 'Wiki mode or group settings prevent you from creating pages'
            ]);
        }
        
        // Check if page with this title already exists in subwiki
        $existingPage = wiki_get_page_by_title($subwiki->id, $title);
        if ($existingPage) {
            throw new ValidationException('A page with this title already exists', [
                'field' => 'title',
                'value' => $title,
                'subwikiid' => $subwikiid,
                'existingPageId' => $existingPage->id,
                'reason' => 'Page titles must be unique within a subwiki'
            ]);
        }
        
        // Determine page format
        $format = $providedFormat;
        if ($format === null || $format === '') {
            // Use wiki's default format if not provided
            $format = $wiki->defaultformat;
        }
        
        // Validate format is one of the allowed values
        $validFormats = ['creole', 'nwiki', 'html'];
        if (!in_array($format, $validFormats)) {
            throw new ValidationException('Invalid page format', [
                'field' => 'format',
                'value' => $format,
                'allowedValues' => $validFormats,
                'reason' => 'Format must be one of: creole, nwiki, html'
            ]);
        }
        
        // Get authenticated user
        $user = $this->getUser();
        
        // Create the page using existing Moodle function
        // This function creates both the page record and initial version
        $pageid = wiki_create_page($subwiki->id, $title, $format, $user->id);
        
        if (!$pageid) {
            throw new ApiException(500, 'PAGE_CREATION_FAILED', 'Failed to create wiki page', [
                'subwikiid' => $subwikiid,
                'title' => $title,
                'format' => $format,
                'reason' => 'wiki_create_page() returned false or null'
            ]);
        }
        
        // If content was provided, save it to the page
        if (!empty($content)) {
            // Get the created page object
            $page = wiki_get_page($pageid);
            if (!$page) {
                throw new ApiException(500, 'PAGE_RETRIEVAL_FAILED', 'Failed to retrieve created page', [
                    'pageid' => $pageid,
                    'reason' => 'Page was created but could not be retrieved'
                ]);
            }
            
            // Save the content using existing Moodle function
            // This creates a version record and updates cache/links
            $versionid = wiki_save_page($page, $content, $user->id);
            
            if (!$versionid) {
                throw new ApiException(500, 'CONTENT_SAVE_FAILED', 'Failed to save page content', [
                    'pageid' => $pageid,
                    'reason' => 'wiki_save_page() returned false or null'
                ]);
            }
        }
        
        // Get the complete page data for response
        $createdPage = wiki_get_page($pageid);
        if (!$createdPage) {
            throw new ApiException(500, 'PAGE_RETRIEVAL_FAILED', 'Failed to retrieve created page', [
                'pageid' => $pageid,
                'reason' => 'Page was created but could not be retrieved for response'
            ]);
        }
        
        // Get the current version (latest version after save)
        $currentVersion = $DB->get_record('wiki_versions', [
            'pageid' => $pageid
        ], '*', IGNORE_MULTIPLE);
        
        // Build response data
        $responseData = [
            'page_id' => (int)$createdPage->id,
            'title' => $createdPage->title,
            'subwikiid' => (int)$createdPage->subwikiid,
            'timemodified' => (int)$createdPage->timemodified,
            'format' => $format,
        ];
        
        // Add version information if available
        if ($currentVersion) {
            $responseData['version_id'] = (int)$currentVersion->id;
            $responseData['content'] = $currentVersion->content;
            $responseData['timecreated'] = (int)$currentVersion->timecreated;
        } else {
            // If no version found, include empty content
            $responseData['content'] = '';
        }
        
        // Return success response with 201 Created status
        $this->success($responseData, 201);
    }
    
    /**
     * Handle GET request - not allowed for wiki page creation endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not allowed for wiki page creation endpoint');
    }
    
    /**
     * Handle PUT request - not allowed for wiki page creation endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not allowed for wiki page creation endpoint');
    }
    
    /**
     * Handle DELETE request - not allowed for wiki page creation endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed for wiki page creation endpoint');
    }
}

// Instantiate and execute the endpoint
// Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new WikiCreatePageEndpoint();
    $endpoint->execute();
}
