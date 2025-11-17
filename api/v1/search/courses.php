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
 * REST API endpoint for searching courses with filtering, pagination, and relevance ranking.
 *
 * Provides course search functionality for the React frontend by wrapping Moodle's
 * core_course_category::search_courses() function. Supports full-text search across
 * course names, shortnames, idnumbers, and summary text with various filtering options.
 *
 * Endpoint: GET /api/v1/search/courses
 *
 * Query Parameters:
 * - q or search: Search query string (required)
 * - page: Page number for pagination (default: 0)
 * - perpage: Results per page (default: 20, max: 100)
 * - categoryid: Filter by category ID (optional)
 * - tagid: Filter by tag ID (optional)
 * - blocklist: Filter by block ID (optional)
 * - modulelist: Filter by module name (optional)
 * - sortby: Sort order - 'relevance', 'name', or 'date' (default: 'relevance')
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "courses": [
 *       {
 *         "id": 123,
 *         "fullname": "Course Title",
 *         "shortname": "COURSE101",
 *         "idnumber": "C101",
 *         "summary": "Course description",
 *         "summaryformat": 1,
 *         "startdate": 1609459200,
 *         "enddate": 1640995200,
 *         "visible": 1,
 *         "format": "topics",
 *         "categoryid": 5,
 *         "categoryname": "Category Name",
 *         "enrollmentcount": 45,
 *         "imageurl": "https://..."
 *       }
 *     ],
 *     "total": 150,
 *     "page": 0,
 *     "perpage": 20,
 *     "totalpages": 8,
 *     "query": "search term",
 *     "filters": {
 *       "categoryid": 5,
 *       "tagid": null,
 *       "sortby": "relevance"
 *     }
 *   }
 * }
 *
 * Authentication:
 * - JWT token optional for public courses (when $CFG->forcelogin is false)
 * - JWT token required for accessing hidden/restricted courses
 * - Respects course visibility and enrollment permissions automatically
 *
 * Security:
 * - Applies capability filtering through core_course_category::search_courses()
 * - Checks moodle/course:viewhiddencourses for hidden courses
 * - Validates and sanitizes all input parameters
 * - Triggers \core\event\courses_searched event for audit logging
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and API base class
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/course/lib.php');

/**
 * Course search API endpoint class.
 *
 * Extends ApiBase to provide REST API functionality for searching courses
 * with filtering, pagination, and relevance ranking. Wraps existing Moodle
 * core search functionality without duplicating any business logic.
 */
class CourseSearchEndpoint extends ApiBase {
    
    /**
     * Maximum allowed results per page to prevent resource exhaustion.
     */
    const MAX_PER_PAGE = 100;
    
    /**
     * Default number of results per page.
     */
    const DEFAULT_PER_PAGE = 20;
    
    /**
     * Constructor - override to make authentication optional for public courses.
     *
     * Allows access without JWT token when $CFG->forcelogin is false,
     * enabling public course catalog browsing. Authentication is still
     * required for accessing hidden or restricted courses.
     */
    public function __construct() {
        global $CFG;
        
        // Allow public access when forcelogin is disabled
        $this->requireAuth = !empty($CFG->forcelogin);
        
        // Call parent constructor for JWT validation (if required)
        parent::__construct();
    }
    
    /**
     * Handle GET request for course search.
     *
     * Implements the main course search logic by:
     * 1. Extracting and validating query parameters
     * 2. Building search criteria array
     * 3. Calling core_course_category::search_courses()
     * 4. Formatting results with course details and pagination metadata
     * 5. Triggering courses_searched event
     *
     * @return void Outputs JSON response directly via success() method
     * @throws ValidationException If required parameters are missing or invalid
     * @throws ServerException If search operation fails
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        try {
            // Extract search query parameter (supports both 'q' and 'search')
            $q = $this->getParam('q', PARAM_RAW, false, '');
            $search = $this->getParam('search', PARAM_RAW, false, '');
            
            // Use 'q' if provided, otherwise use 'search'
            if (!empty($q)) {
                $search = $q;
            }
            
            // Trim and sanitize search query
            $search = trim(strip_tags($search));
            
            // Extract pagination parameters
            $page = $this->getParam('page', PARAM_INT, false, 0);
            $perpage = $this->getParam('perpage', PARAM_INT, false, self::DEFAULT_PER_PAGE);
            
            // Validate and cap perpage
            if ($perpage < 1) {
                $perpage = self::DEFAULT_PER_PAGE;
            }
            if ($perpage > self::MAX_PER_PAGE) {
                $perpage = self::MAX_PER_PAGE;
            }
            
            // Validate page number
            if ($page < 0) {
                $page = 0;
            }
            
            // Extract filter parameters
            $categoryid = $this->getParam('categoryid', PARAM_INT, false, null);
            $tagid = $this->getParam('tagid', PARAM_INT, false, null);
            $blocklist = $this->getParam('blocklist', PARAM_INT, false, null);
            $modulelist = $this->getParam('modulelist', PARAM_PLUGIN, false, null);
            
            // Extract sort parameter
            $sortby = $this->getParam('sortby', PARAM_ALPHA, false, 'relevance');
            
            // Validate sortby parameter
            $validSortOptions = ['relevance', 'name', 'date'];
            if (!in_array($sortby, $validSortOptions)) {
                $sortby = 'relevance';
            }
            
            // Build search criteria array following Moodle pattern
            $searchcriteria = array();
            
            // Add search query
            if (!empty($search)) {
                $searchcriteria['search'] = $search;
            }
            
            // Add filters if provided
            if (!empty($categoryid)) {
                $searchcriteria['categoryid'] = $categoryid;
            }
            
            if (!empty($tagid)) {
                $searchcriteria['tagid'] = $tagid;
            }
            
            if (!empty($blocklist)) {
                $searchcriteria['blocklist'] = $blocklist;
            }
            
            if (!empty($modulelist)) {
                $searchcriteria['modulelist'] = $modulelist;
            }
            
            // Build display options for search execution
            $displayoptions = array();
            
            // Set sort order based on sortby parameter
            if ($sortby === 'name') {
                $displayoptions['sort'] = array('displayname' => 1);
            } else if ($sortby === 'date') {
                $displayoptions['sort'] = array('startdate' => -1);  // Descending order
            } else {
                // Default to relevance (natural order from search)
                $displayoptions['sort'] = array('sortorder' => 1);
            }
            
            // Set pagination options
            $displayoptions['limit'] = $perpage;
            $displayoptions['offset'] = $perpage * $page;
            
            // Execute course search using core Moodle function
            // This automatically handles:
            // - Permission filtering (course visibility, viewhiddencourses capability)
            // - Full-text search across name, shortname, idnumber, summary
            // - Category filtering
            // - Tag filtering
            // - Block/module filtering
            $courselistelements = core_course_category::search_courses($searchcriteria, $displayoptions);
            
            // Get total count for pagination metadata
            $totalcount = core_course_category::search_courses_count($searchcriteria, $displayoptions);
            
            // Format course results for JSON response
            $courses = array();
            
            foreach ($courselistelements as $courseid => $courseelement) {
                // Extract course data from core_course_list_element object
                $coursedata = array(
                    'id' => $courseelement->id,
                    'fullname' => $courseelement->fullname,
                    'shortname' => $courseelement->shortname,
                    'idnumber' => $courseelement->idnumber,
                    'summary' => $courseelement->summary,
                    'summaryformat' => $courseelement->summaryformat,
                    'startdate' => $courseelement->startdate,
                    'enddate' => $courseelement->enddate,
                    'visible' => $courseelement->visible,
                    'format' => $courseelement->format,
                    'categoryid' => $courseelement->category,
                );
                
                // Add category name
                try {
                    $category = core_course_category::get($courseelement->category);
                    $coursedata['categoryname'] = $category->name;
                } catch (Exception $e) {
                    $coursedata['categoryname'] = '';
                }
                
                // Add enrollment count if user is authenticated and has permission
                $coursedata['enrollmentcount'] = null;
                if ($this->user !== null) {
                    try {
                        $context = context_course::instance($courseelement->id);
                        if (has_capability('moodle/course:enrolreview', $context, $this->user->id)) {
                            // Count enrolled users
                            $enrolledusers = get_enrolled_users($context, '', 0, 'u.id', null, 0, 0, false);
                            $coursedata['enrollmentcount'] = count($enrolledusers);
                        }
                    } catch (Exception $e) {
                        // If we can't get enrollment count, leave it null
                        $coursedata['enrollmentcount'] = null;
                    }
                }
                
                // Get course image URL
                $coursedata['imageurl'] = null;
                try {
                    // Try to get course overview files (images)
                    $overviewfiles = $courseelement->get_course_overviewfiles();
                    if (!empty($overviewfiles)) {
                        $overviewfile = reset($overviewfiles);  // Get first image
                        $coursedata['imageurl'] = moodle_url::make_webservice_pluginfile_url(
                            $overviewfile->get_contextid(),
                            $overviewfile->get_component(),
                            $overviewfile->get_filearea(),
                            null,
                            $overviewfile->get_filepath(),
                            $overviewfile->get_filename()
                        )->out(false);
                    }
                } catch (Exception $e) {
                    // If we can't get image, leave it null
                    $coursedata['imageurl'] = null;
                }
                
                $courses[] = $coursedata;
            }
            
            // Calculate pagination metadata
            $totalpages = ($totalcount > 0) ? (int) ceil($totalcount / $perpage) : 0;
            
            // Build filters object for response
            $appliedfilters = array(
                'categoryid' => $categoryid,
                'tagid' => $tagid,
                'blocklist' => $blocklist,
                'modulelist' => $modulelist,
                'sortby' => $sortby,
            );
            
            // Remove null filters
            $appliedfilters = array_filter($appliedfilters, function($value) {
                return $value !== null;
            });
            
            // Prepare response data
            $responsedata = array(
                'courses' => $courses,
                'total' => $totalcount,
                'page' => $page,
                'perpage' => $perpage,
                'totalpages' => $totalpages,
                'query' => $search,
                'filters' => $appliedfilters,
            );
            
            // Trigger courses_searched event for audit logging
            if (!empty($search)) {
                $eventparams = array(
                    'context' => context_system::instance(),
                    'other' => array('query' => $search)
                );
                $event = \core\event\courses_searched::create($eventparams);
                $event->trigger();
            }
            
            // Return success response with course data
            $this->success($responsedata);
            
        } catch (ApiException $e) {
            // Re-throw API exceptions (they'll be handled by execute() method)
            throw $e;
            
        } catch (moodle_exception $e) {
            // Wrap Moodle exceptions as ServerException
            throw new ServerException(
                'Course search operation failed',
                array(
                    'originalError' => $e->getMessage(),
                    'errorcode' => $e->errorcode ?? 'search_failed',
                    'debuginfo' => $e->debuginfo ?? null
                )
            );
            
        } catch (Exception $e) {
            // Wrap unexpected exceptions as ServerException
            throw new ServerException(
                'Unexpected error during course search',
                array(
                    'originalError' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine()
                )
            );
        }
    }
    
    /**
     * Handle POST requests - not supported for search endpoint.
     *
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for course search');
    }
    
    /**
     * Handle PUT requests - not supported for search endpoint.
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for course search');
    }
    
    /**
     * Handle DELETE requests - not supported for search endpoint.
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for course search');
    }
}

// Instantiate and execute the endpoint
$endpoint = new CourseSearchEndpoint();
$endpoint->execute();
