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
 * API endpoint for listing courses with pagination, search, and filtering.
 *
 * This endpoint provides a RESTful interface to retrieve a paginated list of courses
 * accessible to the authenticated user based on their permissions and enrollment status.
 * It wraps the existing core_course_external::get_courses() function and adds support for
 * pagination, search filtering, category filtering, and sorting options.
 *
 * Endpoint: GET /api/v1/courses
 *
 * Query Parameters:
 * - page (int, optional): Zero-based page number for pagination (default: 0)
 * - perpage (int, optional): Number of courses per page, min 1, max 100 (default: 20)
 * - search (string, optional): Search query to filter by course name or description
 * - categoryid (int, optional): Filter courses by category ID
 * - onlywithcompletion (bool, optional): Only return courses with completion tracking enabled
 * - sort (string, optional): Sort field - sortorder, fullname, shortname, timecreated (default: sortorder)
 * - sortdirection (string, optional): Sort direction - ASC or DESC (default: ASC)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "courses": [
 *       {
 *         "id": 5,
 *         "fullname": "Introduction to Programming",
 *         "shortname": "CS101",
 *         "displayname": "Introduction to Programming",
 *         "categoryid": 2,
 *         "summary": "Learn the basics of programming...",
 *         "summaryformat": 1,
 *         "format": "topics",
 *         "startdate": 1704067200,
 *         "enddate": 1719792000,
 *         "visible": 1,
 *         "showactivitydates": 1,
 *         "showcompletionconditions": 1
 *       },
 *       ...
 *     ]
 *   },
 *   "meta": {
 *     "pagination": {
 *       "page": 0,
 *       "perPage": 20,
 *       "total": 150,
 *       "totalPages": 8
 *     }
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid parameters (negative page, perpage out of range, invalid sort field)
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 500 Internal Server Error: Unexpected server error
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load required Moodle core files
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/course/externallib.php');

// Load API base class and exceptions
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Course Index API Endpoint
 *
 * Handles GET requests to retrieve a paginated, searchable, and filterable list of courses.
 * Extends ApiBase to inherit JWT authentication, request routing, and response formatting.
 *
 * This endpoint delegates to the existing core_course_external::get_courses() function to
 * retrieve course data, ensuring all business logic and permission checks remain in the
 * Moodle core. The endpoint adds presentation-layer concerns such as pagination metadata,
 * additional filtering, and standardized JSON response formatting.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class CourseIndexEndpoint extends ApiBase {

    /**
     * Handle GET request to retrieve courses list.
     *
     * This method processes the request to list courses with pagination, search, and filtering support.
     * It validates all query parameters, calls the existing Moodle core function to retrieve courses,
     * applies additional client-side filtering as needed, calculates pagination metadata, and returns
     * a standardized JSON response.
     *
     * Request Flow:
     * 1. Extract and validate query parameters (page, perpage, search, etc.)
     * 2. Call core_course_external::get_courses() to retrieve all accessible courses
     * 3. Apply additional filtering (search term, category, completion requirement)
     * 4. Apply sorting based on sort and sortdirection parameters
     * 5. Calculate pagination: offset, limit, total count, total pages
     * 6. Extract the requested page of results
     * 7. Return success response with courses array and pagination metadata
     *
     * The core_course_external::get_courses() function already handles:
     * - Context validation and permission checks (moodle/course:view)
     * - Filtering hidden courses based on moodle/course:viewhiddencourses capability
     * - Returning appropriate fields based on user's update permission
     *
     * @return void Outputs JSON response directly
     * @throws ValidationException If any request parameters are invalid
     * @throws ApiException If unexpected errors occur during processing
     */
    protected function handle_get() {
        global $DB;

        // ==================== PARAMETER EXTRACTION AND VALIDATION ====================
        
        // Extract page parameter (zero-based pagination)
        $page = $this->getParam('page', PARAM_INT, false, 0);
        if ($page < 0) {
            throw new ValidationException('Invalid page parameter', [
                'field' => 'page',
                'value' => $page,
                'rule' => 'Must be greater than or equal to 0'
            ]);
        }

        // Extract perpage parameter with validation (min 1, max 100)
        $perpage = $this->getParam('perpage', PARAM_INT, false, 20);
        if ($perpage < 1) {
            throw new ValidationException('Invalid perpage parameter', [
                'field' => 'perpage',
                'value' => $perpage,
                'rule' => 'Must be at least 1'
            ]);
        }
        if ($perpage > 100) {
            throw new ValidationException('Invalid perpage parameter', [
                'field' => 'perpage',
                'value' => $perpage,
                'rule' => 'Must not exceed 100'
            ]);
        }

        // Extract optional search query parameter
        $search = $this->getParam('search', PARAM_TEXT, false, '');
        $search = trim($search);

        // Extract optional category filter parameter
        $categoryid = $this->getParam('categoryid', PARAM_INT, false, null);
        if ($categoryid !== null && $categoryid < 0) {
            throw new ValidationException('Invalid categoryid parameter', [
                'field' => 'categoryid',
                'value' => $categoryid,
                'rule' => 'Must be a positive integer'
            ]);
        }

        // Extract optional completion tracking filter
        $onlywithcompletion = $this->getParam('onlywithcompletion', PARAM_BOOL, false, false);

        // Extract and validate sort field parameter
        $allowedSortFields = ['sortorder', 'fullname', 'shortname', 'timecreated'];
        $sort = $this->getParam('sort', PARAM_TEXT, false, 'sortorder');
        $sort = trim(strtolower($sort));
        if (!in_array($sort, $allowedSortFields)) {
            throw new ValidationException('Invalid sort parameter', [
                'field' => 'sort',
                'value' => $sort,
                'rule' => 'Must be one of: ' . implode(', ', $allowedSortFields)
            ]);
        }

        // Extract and validate sort direction parameter
        $sortdirection = $this->getParam('sortdirection', PARAM_TEXT, false, 'ASC');
        $sortdirection = trim(strtoupper($sortdirection));
        if (!in_array($sortdirection, ['ASC', 'DESC'])) {
            throw new ValidationException('Invalid sortdirection parameter', [
                'field' => 'sortdirection',
                'value' => $sortdirection,
                'rule' => 'Must be either ASC or DESC'
            ]);
        }

        // ==================== RETRIEVE COURSES FROM MOODLE CORE ====================

        // Build options array for core_course_external::get_courses()
        // Empty options means "return all accessible courses" (filtered by permissions)
        $options = [];

        // Call existing Moodle core function to retrieve courses
        // This function handles all permission checks and returns only courses
        // the authenticated user is allowed to see based on their capabilities
        $courses = core_course_external::get_courses($options);

        // ==================== APPLY ADDITIONAL FILTERING ====================

        // Filter by search query if provided (case-insensitive search in fullname, shortname, summary)
        if (!empty($search)) {
            $searchLower = core_text::strtolower($search);
            $courses = array_filter($courses, function($course) use ($searchLower) {
                $fullnameLower = core_text::strtolower($course['fullname']);
                $shortnameLower = core_text::strtolower($course['shortname']);
                $summaryLower = core_text::strtolower(strip_tags($course['summary']));
                
                return (strpos($fullnameLower, $searchLower) !== false ||
                        strpos($shortnameLower, $searchLower) !== false ||
                        strpos($summaryLower, $searchLower) !== false);
            });
            // Re-index array after filtering
            $courses = array_values($courses);
        }

        // Filter by category ID if provided
        if ($categoryid !== null) {
            $courses = array_filter($courses, function($course) use ($categoryid) {
                return $course['categoryid'] == $categoryid;
            });
            // Re-index array after filtering
            $courses = array_values($courses);
        }

        // Filter by completion tracking if requested
        if ($onlywithcompletion) {
            $courses = array_filter($courses, function($course) {
                // Check if enablecompletion field exists and is enabled
                return isset($course['enablecompletion']) && $course['enablecompletion'] == 1;
            });
            // Re-index array after filtering
            $courses = array_values($courses);
        }

        // ==================== APPLY SORTING ====================

        // Sort courses based on requested field and direction
        usort($courses, function($a, $b) use ($sort, $sortdirection) {
            // Handle different sort fields
            switch ($sort) {
                case 'fullname':
                case 'shortname':
                    $aValue = core_text::strtolower($a[$sort]);
                    $bValue = core_text::strtolower($b[$sort]);
                    $comparison = strcmp($aValue, $bValue);
                    break;
                
                case 'timecreated':
                    // timecreated may only be available for users with update permission
                    $aValue = isset($a[$sort]) ? $a[$sort] : 0;
                    $bValue = isset($b[$sort]) ? $b[$sort] : 0;
                    $comparison = $aValue - $bValue;
                    break;
                
                case 'sortorder':
                default:
                    // sortorder may only be available for users with update permission
                    // Fall back to id if sortorder not available
                    $aValue = isset($a['categorysortorder']) ? $a['categorysortorder'] : $a['id'];
                    $bValue = isset($b['categorysortorder']) ? $b['categorysortorder'] : $b['id'];
                    $comparison = $aValue - $bValue;
                    break;
            }

            // Apply sort direction
            return ($sortdirection === 'DESC') ? -$comparison : $comparison;
        });

        // ==================== CALCULATE PAGINATION ====================

        // Calculate total number of courses after filtering
        $total = count($courses);

        // Calculate total pages
        $totalPages = ($total > 0) ? (int) ceil($total / $perpage) : 0;

        // Validate page number doesn't exceed total pages
        if ($page > 0 && $page >= $totalPages && $totalPages > 0) {
            // If requested page exceeds available pages, set to last page
            $page = $totalPages - 1;
        }

        // Calculate offset for pagination
        $offset = $page * $perpage;

        // Extract the requested page of results using array_slice
        $coursesPage = array_slice($courses, $offset, $perpage);

        // ==================== BUILD PAGINATION METADATA ====================

        $pagination = [
            'page' => $page,
            'perPage' => $perpage,
            'total' => $total,
            'totalPages' => $totalPages
        ];

        // ==================== RETURN SUCCESS RESPONSE ====================

        // Return standardized JSON response with courses data and pagination metadata
        // Using the success() method inherited from ApiBase which formats the response
        // in the standard envelope: {success: true, data: {...}, meta: {...}}
        return $this->success(
            ['courses' => $coursesPage],
            200,
            ['pagination' => $pagination]
        );
    }
}

// ==================== ENDPOINT EXECUTION ====================

// Instantiate and execute the endpoint
// The constructor (inherited from ApiBase) will:
// 1. Validate the JWT token from Authorization header
// 2. Extract and set the authenticated user
// 3. Handle authentication errors
//
// The execute() method (inherited from ApiBase) will:
// 1. Route the request to handle_get() based on HTTP method
// 2. Catch and format any exceptions as JSON error responses
// 3. Output the final JSON response
$endpoint = new CourseIndexEndpoint();
$endpoint->execute();
