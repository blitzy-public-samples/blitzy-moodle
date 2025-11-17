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
 * REST API endpoint for unified global search across all content types.
 *
 * Provides GET endpoint for searching courses, activities, resources, forum posts,
 * pages, and files. Wraps Moodle's \core_search\manager::search() function to
 * perform full-text search across all indexed content with relevance ranking.
 *
 * Endpoint: GET /api/v1/search
 *
 * Query Parameters:
 * - q (required): Search query string (minimum 2 characters)
 * - page (optional): Page number for pagination (default: 0)
 * - perpage (optional): Results per page, max 50 (default: 10)
 * - areaids (optional): Array of search area IDs to filter results
 * - courseids (optional): Array of course IDs to restrict search
 * - timestart (optional): Unix timestamp for start date filter
 * - timeend (optional): Unix timestamp for end date filter
 * - title (optional): Boolean to search titles only (default: false)
 *
 * Returns JSON response with:
 * - results: Array of search documents with type, title, content, author, etc.
 * - total: Estimated total results count
 * - page: Current page number
 * - perpage: Results per page
 * - query: The search query string
 * - filters: Applied filter parameters
 * - areas_available: List of searchable content areas
 *
 * Requires:
 * - Global search enabled in site configuration ($CFG->enableglobalsearch)
 * - Search engine configured and ready
 * - Valid JWT authentication token
 * - User must be authenticated (global search requires user context)
 *
 * Access control:
 * - Results automatically filtered based on user permissions
 * - Document access callbacks ensure users only see content they can access
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries.
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/moodlelib.php');

// Load API utilities.
require_once($CFG->dirroot . '/api/lib/api_base.php');
require_once($CFG->dirroot . '/api/lib/api_exception.php');

/**
 * Global search API endpoint class.
 *
 * Handles GET requests for unified global search across all Moodle content types.
 * Extends ApiBase to inherit JWT validation, routing, and response formatting.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class GlobalSearchEndpoint extends ApiBase {
    
    /**
     * Handle GET request for global search.
     *
     * Processes search query with filters and pagination, delegates to Moodle's
     * core search manager, and returns JSON-formatted search results with
     * document metadata and relevance scores.
     *
     * @return void Outputs JSON response directly
     * @throws UnauthorizedException If user is not authenticated
     * @throws ServerException If global search is not enabled or engine error occurs
     * @throws ValidationException If query parameters are invalid
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Get authenticated user - REQUIRED for global search.
        $user = $this->getUser();
        if (!$user) {
            throw new UnauthorizedException('Authentication required for global search');
        }
        
        // Check if global search is enabled in site configuration.
        if (!\core_search\manager::is_global_search_enabled()) {
            throw new ServerException('Global search is not enabled', [
                'hint' => 'Administrator must enable global search in Site administration > Advanced features',
                'config_required' => 'enableglobalsearch'
            ]);
        }
        
        // Retrieve and validate search parameters.
        $query = $this->getParam('q', PARAM_NOTAGS, true, null); // Required parameter
        $page = $this->getParam('page', PARAM_INT, false, 0);
        $perpage = $this->getParam('perpage', PARAM_INT, false, 10);
        $areaids = $this->getParam('areaids', PARAM_ALPHANUMEXT, false, null);
        $courseids = $this->getParam('courseids', PARAM_INT, false, null);
        $timestart = $this->getParam('timestart', PARAM_INT, false, null);
        $timeend = $this->getParam('timeend', PARAM_INT, false, null);
        $title = $this->getParam('title', PARAM_BOOL, false, false);
        
        // Validate query string.
        if (empty($query)) {
            throw new ValidationException('Search query cannot be empty', [
                'parameter' => 'q',
                'required' => true
            ]);
        }
        
        // Sanitize and validate query length.
        $query = clean_param($query, PARAM_NOTAGS);
        if (core_text::strlen($query) < 2) {
            throw new ValidationException('Search query must be at least 2 characters', [
                'parameter' => 'q',
                'min_length' => 2,
                'provided_length' => core_text::strlen($query)
            ]);
        }
        
        // Validate pagination parameters.
        if ($page < 0) {
            throw new ValidationException('Page number must be non-negative', [
                'parameter' => 'page',
                'provided' => $page
            ]);
        }
        
        if ($perpage <= 0 || $perpage > 50) {
            throw new ValidationException('Results per page must be between 1 and 50', [
                'parameter' => 'perpage',
                'provided' => $perpage,
                'max' => 50
            ]);
        }
        
        // Convert area IDs parameter to array if provided.
        $areaidarray = null;
        if ($areaids !== null) {
            if (is_array($areaids)) {
                $areaidarray = $areaids;
            } else {
                // Handle comma-separated string.
                $areaidarray = array_filter(array_map('trim', explode(',', $areaids)));
            }
        }
        
        // Convert course IDs parameter to array if provided.
        $courseidarray = null;
        if ($courseids !== null) {
            if (is_array($courseids)) {
                $courseidarray = array_map('intval', $courseids);
            } else {
                // Handle comma-separated string.
                $courseidarray = array_filter(array_map('intval', explode(',', $courseids)));
            }
        }
        
        // Validate time range if provided.
        if ($timestart !== null && $timeend !== null && $timestart > $timeend) {
            throw new ValidationException('Start time must be before end time', [
                'timestart' => $timestart,
                'timeend' => $timeend
            ]);
        }
        
        // Get search manager instance and verify engine is ready.
        try {
            $searchmanager = \core_search\manager::instance();
        } catch (\core_search\engine_exception $e) {
            throw new ServerException('Search engine is not properly configured', [
                'error' => $e->getMessage(),
                'hint' => 'Administrator must configure a search engine in Site administration > Plugins > Search'
            ]);
        }
        
        // Check if search engine is ready.
        $engine = $searchmanager->get_engine();
        if (!$engine || !$engine->is_installed()) {
            throw new ServerException('Search engine is not installed or ready', [
                'hint' => 'Administrator must install and configure the search engine'
            ]);
        }
        
        // Build form data object for search manager following Moodle's pattern.
        $formdata = new stdClass();
        $formdata->q = $query;
        $formdata->title = $title;
        
        if ($timestart !== null) {
            $formdata->timestart = $timestart;
        }
        
        if ($timeend !== null) {
            $formdata->timeend = $timeend;
        }
        
        if ($areaidarray !== null && !empty($areaidarray)) {
            $formdata->areaids = $areaidarray;
        }
        
        if ($courseidarray !== null && !empty($courseidarray)) {
            $formdata->courseids = $courseidarray;
        }
        
        // Calculate limit for search - get results up to end of current page.
        // This follows Moodle's pattern of requesting all results up to the desired page.
        $limit = $perpage * ($page + 1);
        
        // Execute search using Moodle's core search manager.
        // This automatically filters results based on user permissions.
        try {
            $docs = $searchmanager->search($formdata, $limit);
        } catch (\moodle_exception $e) {
            throw new ServerException('Search query execution failed', [
                'error' => $e->getMessage(),
                'errorcode' => $e->errorcode
            ]);
        }
        
        // Get total count (may not be exact with some search engines).
        $totalcount = count($docs);
        
        // Slice results for current page.
        $offset = $page * $perpage;
        $pagedocs = array_slice($docs, $offset, $perpage);
        
        // Build results array with enriched document data.
        $results = [];
        foreach ($pagedocs as $doc) {
            // Extract base document properties.
            $result = [
                'docid' => $doc->get('id'),
                'itemid' => $doc->get('itemid'),
                'componentname' => $doc->get('componentname'),
                'areaname' => $doc->get('areaname'),
                'courseid' => $doc->get('courseid'),
                'contextid' => $doc->get('contextid'),
                'title' => $doc->get('title'),
                'content' => $doc->get('content'),
                'modified' => $doc->get('modified'),
                'owneruserid' => $doc->get('owneruserid'),
                'type' => $doc->get('type'),
            ];
            
            // Add URL to view the full content if available.
            $contexturl = $doc->get_context_url();
            if ($contexturl) {
                $result['contexturl'] = $contexturl->out(false);
            }
            
            // Add direct document URL if available.
            $docurl = $doc->get_doc_url();
            if ($docurl) {
                $result['docurl'] = $docurl->out(false);
            }
            
            // Add relevance score if available from search engine.
            $score = $doc->get('score');
            if ($score !== null) {
                $result['score'] = $score;
            }
            
            // Create plain text description from content (limited to 200 characters).
            $description = strip_tags($result['content']);
            $description = core_text::substr($description, 0, 200);
            if (core_text::strlen($result['content']) > 200) {
                $description .= '...';
            }
            $result['description'] = $description;
            
            // Enrich with author information if owner user ID is set.
            if ($result['owneruserid'] && $result['owneruserid'] > 0) {
                try {
                    $author = $DB->get_record('user', ['id' => $result['owneruserid']], 
                        'id, firstname, lastname', IGNORE_MISSING);
                    if ($author) {
                        $result['author_fullname'] = fullname($author);
                    }
                } catch (\dml_exception $e) {
                    // Skip author enrichment if user record not found.
                    debugging('Could not load author for search result: ' . $e->getMessage(), DEBUG_DEVELOPER);
                }
            }
            
            // Enrich with course information if course ID is set.
            if ($result['courseid'] && $result['courseid'] > 0) {
                try {
                    $course = $DB->get_record('course', ['id' => $result['courseid']], 
                        'id, fullname, shortname', IGNORE_MISSING);
                    if ($course) {
                        $result['course_fullname'] = $course->fullname;
                        $result['course_shortname'] = $course->shortname;
                    }
                } catch (\dml_exception $e) {
                    // Skip course enrichment if course record not found.
                    debugging('Could not load course for search result: ' . $e->getMessage(), DEBUG_DEVELOPER);
                }
            }
            
            // Enrich with context information.
            if ($result['contextid']) {
                try {
                    $context = \context::instance_by_id($result['contextid'], IGNORE_MISSING);
                    if ($context) {
                        $result['context_name'] = $context->get_context_name();
                        $result['context_level'] = $context->contextlevel;
                    }
                } catch (\dml_exception $e) {
                    // Skip context enrichment if context not found.
                    debugging('Could not load context for search result: ' . $e->getMessage(), DEBUG_DEVELOPER);
                }
            }
            
            $results[] = $result;
        }
        
        // Get available search areas for filter information.
        $searcharealist = \core_search\manager::get_search_areas_list();
        $areasavailable = [];
        foreach ($searcharealist as $areaid => $areaname) {
            $areasavailable[] = [
                'areaid' => $areaid,
                'areaname' => $areaname
            ];
        }
        
        // Build filters object showing what filters were applied.
        $appliedfilters = [];
        if ($areaidarray !== null && !empty($areaidarray)) {
            $appliedfilters['areaids'] = $areaidarray;
        }
        if ($courseidarray !== null && !empty($courseidarray)) {
            $appliedfilters['courseids'] = $courseidarray;
        }
        if ($timestart !== null || $timeend !== null) {
            $appliedfilters['timerange'] = [];
            if ($timestart !== null) {
                $appliedfilters['timerange']['start'] = $timestart;
            }
            if ($timeend !== null) {
                $appliedfilters['timerange']['end'] = $timeend;
            }
        }
        if ($title) {
            $appliedfilters['title_only'] = true;
        }
        
        // Log search query for analytics using Moodle's event system.
        try {
            $eventparams = [
                'context' => \context_system::instance(),
                'other' => [
                    'query' => $query,
                    'filters' => $appliedfilters,
                    'results' => count($results)
                ]
            ];
            $event = \core\event\search_results_viewed::create($eventparams);
            $event->trigger();
        } catch (\Exception $e) {
            // Event logging failure should not break the search.
            debugging('Failed to log search event: ' . $e->getMessage(), DEBUG_DEVELOPER);
        }
        
        // Return standardized JSON response with search results and metadata.
        $this->success([
            'results' => $results,
            'total' => $totalcount,
            'page' => $page,
            'perpage' => $perpage,
            'query' => $query,
            'filters' => $appliedfilters,
            'areas_available' => $areasavailable
        ]);
    }
    
    /**
     * Handle POST request - not supported for search endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for search endpoint. Use GET instead.');
    }
    
    /**
     * Handle PUT request - not supported for search endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for search endpoint. Use GET instead.');
    }
    
    /**
     * Handle DELETE request - not supported for search endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for search endpoint. Use GET instead.');
    }
}

// Instantiate and execute the endpoint.
$endpoint = new GlobalSearchEndpoint();
$endpoint->execute();
