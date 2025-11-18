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
 * REST API endpoint for page module content retrieval.
 *
 * Implements GET /api/v1/resources/pages/{id} for retrieving page module content
 * with formatted HTML, embedded file URLs, and display options. This endpoint
 * enables React frontend components to display rich page content with proper
 * completion tracking and file access.
 *
 * Features:
 * - Retrieves page module content by instance ID
 * - Enforces mod/page:view capability permission
 * - Processes @@PLUGINFILE@@ placeholders to accessible URLs
 * - Formats content according to content format (HTML, Markdown, Plain)
 * - Applies Moodle text filters for content processing
 * - Tracks view events and updates completion status
 * - Respects display options (intro, last modified)
 * - Returns embedded file references with working URLs
 * - Provides formatted HTML ready for React rendering
 *
 * Request:
 * GET /api/v1/resources/pages/{id}
 * Headers: Authorization: Bearer <jwt_token>
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "name": "Course Introduction",
 *     "intro": "Raw introduction text",
 *     "introhtml": "<p>Formatted introduction HTML</p>",
 *     "content": "Raw page content",
 *     "contenthtml": "<p>Formatted content with file URLs</p>",
 *     "contentformat": 1,
 *     "display": 5,
 *     "displayoptions": {
 *       "printintro": true,
 *       "printlastmodified": true
 *     },
 *     "revision": 2,
 *     "timemodified": 1638360000,
 *     "course": 5,
 *     "coursemodule": 42,
 *     "section": 1,
 *     "visible": 1,
 *     "embedfiles": [
 *       {
 *         "filename": "image.png",
 *         "filesize": 45678,
 *         "mimetype": "image/png",
 *         "url": "https://moodle.example.com/pluginfile.php/123/..."
 *       }
 *     ]
 *   },
 *   "meta": null
 * }
 *
 * Error responses:
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: User lacks mod/page:view capability
 * - 404 Not Found: Page with specified ID does not exist
 * - 500 Internal Server Error: Unexpected server error
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/page/lib.php');
require_once($CFG->dirroot . '/mod/page/locallib.php');
require_once($CFG->libdir . '/completionlib.php');
require_once($CFG->libdir . '/filelib.php');

// Load API base classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_response.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Page content API endpoint class.
 *
 * Handles retrieval of page module content with proper permission enforcement,
 * content formatting, and file URL rewriting for React frontend consumption.
 * Extends ApiBase to inherit JWT authentication and standard request handling.
 */
class PageContentEndpoint extends ApiBase {
    
    /**
     * Handle GET request for page content retrieval.
     *
     * Retrieves page module content by ID, validates user permissions,
     * processes content with file URL rewriting and text formatting,
     * tracks view events, and returns formatted content ready for display.
     *
     * URL Parameters:
     * - id (required): Page instance ID (PARAM_INT)
     *
     * Process flow:
     * 1. Extract and validate page ID parameter
     * 2. Retrieve page record from database
     * 3. Get course module and course records
     * 4. Load module context
     * 5. Check mod/page:view capability
     * 6. Trigger view event and update completion
     * 7. Rewrite pluginfile URLs in content
     * 8. Format content with text filters
     * 9. Parse and process display options
     * 10. Format intro text if configured
     * 11. Extract embedded file information
     * 12. Return comprehensive JSON response
     *
     * @return void Outputs JSON response directly
     * @throws NotFoundException If page with specified ID does not exist
     * @throws ForbiddenException If user lacks mod/page:view capability
     * @throws ValidationException If page ID parameter is invalid
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Extract page ID from URL parameter
        $pageid = $this->getParam('id', PARAM_INT, true);
        
        // Validate that page ID is positive
        if ($pageid <= 0) {
            throw new ValidationException('Invalid page ID', [
                'parameter' => 'id',
                'value' => $pageid,
                'constraint' => 'Must be a positive integer'
            ]);
        }
        
        // Retrieve page record from database
        $page = $DB->get_record('page', ['id' => $pageid], '*', MUST_EXIST);
        
        if (!$page) {
            throw new NotFoundException("Page with ID {$pageid} not found", [
                'pageId' => $pageid,
                'resource' => 'page'
            ]);
        }
        
        // Get course module from page instance
        $cm = get_coursemodule_from_instance('page', $page->id, $page->course, false, MUST_EXIST);
        
        if (!$cm) {
            throw new NotFoundException("Course module for page {$pageid} not found", [
                'pageId' => $pageid,
                'courseId' => $page->course
            ]);
        }
        
        // Load course record
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        
        if (!$course) {
            throw new NotFoundException("Course {$cm->course} not found", [
                'courseId' => $cm->course,
                'pageId' => $pageid
            ]);
        }
        
        // Get module context for permission checking
        $context = context_module::instance($cm->id);
        
        // Check if user has permission to view this page
        // This will throw ForbiddenException if user lacks capability
        $this->checkCapability('mod/page:view', $context);
        
        // Trigger view event and update completion tracking
        // This calls existing Moodle function that logs the view event
        // and marks the activity as completed if conditions are met
        page_view($page, $course, $cm, $context);
        
        // Process page content to rewrite @@PLUGINFILE@@ placeholders
        // This converts internal file references to accessible URLs
        $content = file_rewrite_pluginfile_urls(
            $page->content,
            'pluginfile.php',
            $context->id,
            'mod_page',
            'content',
            $page->revision
        );
        
        // Set up format options for text formatting
        $formatoptions = new stdClass();
        $formatoptions->noclean = true;           // Don't clean HTML (trust content)
        $formatoptions->overflowdiv = true;       // Wrap in overflow div
        $formatoptions->context = $context;       // Context for capability checks
        
        // Format content with Moodle text filters
        // This applies formatting based on contentformat (HTML, Markdown, Plain)
        // and runs content through enabled Moodle filters
        $contenthtml = format_text($content, $page->contentformat, $formatoptions);
        
        // Parse display options from serialized array
        $displayoptions = [];
        if (!empty($page->displayoptions)) {
            $displayoptions = (array) unserialize_array($page->displayoptions);
        }
        
        // Extract specific display options with defaults
        $printintro = isset($displayoptions['printintro']) ? !empty($displayoptions['printintro']) : true;
        $printlastmodified = isset($displayoptions['printlastmodified']) ? !empty($displayoptions['printlastmodified']) : true;
        
        // Format intro text if printintro option is enabled
        $introhtml = '';
        if ($printintro && !empty($page->intro)) {
            $introhtml = format_module_intro('page', $page, $cm->id);
        }
        
        // Extract embedded files from content area
        $fs = get_file_storage();
        $files = $fs->get_area_files($context->id, 'mod_page', 'content', $page->revision, 'sortorder, id', false);
        
        // Build array of file information with accessible URLs
        $embedfiles = [];
        foreach ($files as $file) {
            // Generate pluginfile URL for each embedded file
            $fileurl = moodle_url::make_pluginfile_url(
                $context->id,
                'mod_page',
                'content',
                $page->revision,
                $file->get_filepath(),
                $file->get_filename()
            );
            
            $embedfiles[] = [
                'filename' => $file->get_filename(),
                'filesize' => $file->get_filesize(),
                'mimetype' => $file->get_mimetype(),
                'url' => $fileurl->out(false)
            ];
        }
        
        // Build comprehensive response data
        $responseData = [
            'id' => (int) $page->id,
            'name' => $page->name,
            'intro' => $page->intro,
            'introhtml' => $introhtml,
            'content' => $page->content,
            'contenthtml' => $contenthtml,
            'contentformat' => (int) $page->contentformat,
            'display' => (int) $page->display,
            'displayoptions' => [
                'printintro' => $printintro,
                'printlastmodified' => $printlastmodified
            ],
            'revision' => (int) $page->revision,
            'timemodified' => (int) $page->timemodified,
            'course' => (int) $page->course,
            'coursemodule' => (int) $cm->id,
            'section' => (int) $cm->section,
            'visible' => (int) $page->visible,
            'embedfiles' => $embedfiles
        ];
        
        // Return success response with formatted data
        $this->success($responseData, 200);
    }
    
    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for page content retrieval', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for page content retrieval', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for page content retrieval', [
            'allowedMethods' => ['GET']
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new PageContentEndpoint();
$endpoint->execute();
