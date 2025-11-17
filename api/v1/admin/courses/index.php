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
 * Admin API endpoint for listing all courses.
 *
 * REST API endpoint for listing all courses with admin-level access, supporting 
 * pagination, filtering, and sorting. Handles GET requests to retrieve comprehensive 
 * course list with metadata including id, fullname, shortname, category, categoryname, 
 * visible, startdate, enddate, enrollment counts, format, and summary.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once(__DIR__ . '/../../../lib/api_base.php');
require_once(__DIR__ . '/../../../lib/api_exception.php');
require_once(__DIR__ . '/../../../lib/api_response.php');

/**
 * Admin courses list endpoint.
 *
 * Provides comprehensive course listing functionality with admin-level permissions.
 * Enforces moodle/course:create or moodle/site:config capability to ensure admin-level 
 * access. Supports query parameters for pagination (page, perPage), filtering 
 * (categoryid, visible, search), and sorting (sortBy, sortOrder).
 *
 * Example request:
 * GET /api/v1/admin/courses?page=1&perPage=20&categoryid=2&visible=1&sortBy=fullname&sortOrder=asc
 *
 * Example response:
 * {
 *   "success": true,
 *   "data": {
 *     "courses": [
 *       {
 *         "id": 5,
 *         "fullname": "Introduction to Programming",
 *         "shortname": "CS101",
 *         "category": 2,
 *         "categoryname": "Computer Science",
 *         "visible": true,
 *         "startdate": 1704067200,
 *         "enddate": 1719792000,
 *         "format": "topics",
 *         "summary": "Learn programming fundamentals",
 *         "summaryformat": 1,
 *         "enrollmentcount": 150
 *       }
 *     ]
 *   },
 *   "meta": {
 *     "pagination": {
 *       "page": 1,
 *       "perPage": 20,
 *       "total": 150,
 *       "totalPages": 8
 *     }
 *   }
 * }
 */
class AdminCoursesIndexEndpoint extends ApiBase {
    
    /**
     * Handle GET requests to list all courses with admin access.
     *
     * Enforces capability checking, extracts and validates query parameters,
     * constructs SQL query with filtering and sorting, executes count and main
     * queries with proper pagination, and returns formatted JSON response.
     *
     * Query Parameters:
     * - page: int, default 1 - Page number for pagination
     * - perPage: int, default 20, max 100 - Items per page
     * - categoryid: int, optional - Filter by category ID
     * - visible: int, optional (0 or 1) - Filter by visibility
     * - search: string, optional - Search in course name or shortname
     * - sortBy: string, default 'fullname' - Sort field (fullname, shortname, category, startdate, visible)
     * - sortOrder: string, default 'asc' - Sort direction (asc, desc)
     *
     * @return void Outputs JSON response via success() method
     * @throws ForbiddenException If user lacks required capabilities
     * @throws ServerException If database operation fails
     */
    protected function handle_get() {
        global $DB;
        
        // Capability check: User must have moodle/course:create OR moodle/site:config
        $context = context_system::instance();
        $hasCreateCap = has_capability('moodle/course:create', $context, $this->getUser());
        $hasConfigCap = has_capability('moodle/site:config', $context, $this->getUser());
        
        if (!$hasCreateCap && !$hasConfigCap) {
            throw new ForbiddenException(
                'Admin-level permission required to list all courses',
                [
                    'requiredCapabilities' => ['moodle/course:create', 'moodle/site:config'],
                    'context' => 'system'
                ]
            );
        }
        
        // Extract and validate query parameters
        $page = $this->getParam('page', PARAM_INT, false);
        if ($page === null || $page < 1) {
            $page = 1;
        }
        
        $perPage = $this->getParam('perPage', PARAM_INT, false);
        if ($perPage === null || $perPage < 1) {
            $perPage = 20;
        }
        // Enforce maximum perPage of 100
        if ($perPage > 100) {
            $perPage = 100;
        }
        
        $categoryid = $this->getParam('categoryid', PARAM_INT, false);
        $visible = $this->getParam('visible', PARAM_INT, false);
        $search = $this->getParam('search', PARAM_TEXT, false);
        $sortBy = $this->getParam('sortBy', PARAM_ALPHA, false);
        $sortOrder = $this->getParam('sortOrder', PARAM_ALPHA, false);
        
        // Validate sortBy against whitelist
        $allowedSortFields = ['fullname', 'shortname', 'category', 'startdate', 'visible'];
        if ($sortBy === null || !in_array($sortBy, $allowedSortFields, true)) {
            $sortBy = 'fullname';
        }
        
        // Validate sortOrder
        if ($sortOrder === null || !in_array(strtolower($sortOrder), ['asc', 'desc'], true)) {
            $sortOrder = 'asc';
        } else {
            $sortOrder = strtolower($sortOrder);
        }
        
        try {
            // Build SQL query with WHERE clause conditions
            $conditions = [];
            $params = [];
            
            // Always exclude site course (SITEID)
            $conditions[] = 'c.id != :siteid';
            $params['siteid'] = SITEID;
            
            // Filter by category if provided
            if ($categoryid !== null) {
                $conditions[] = 'c.category = :categoryid';
                $params['categoryid'] = $categoryid;
            }
            
            // Filter by visibility if provided
            if ($visible !== null) {
                $conditions[] = 'c.visible = :visible';
                $params['visible'] = $visible;
            }
            
            // Filter by search term if provided
            if ($search !== null && $search !== '') {
                $conditions[] = '(' . $DB->sql_like('c.fullname', ':search1', false) . ' OR ' . 
                                      $DB->sql_like('c.shortname', ':search2', false) . ')';
                $searchParam = '%' . $DB->sql_like_escape($search) . '%';
                $params['search1'] = $searchParam;
                $params['search2'] = $searchParam;
            }
            
            // Construct WHERE clause
            $whereClause = '';
            if (!empty($conditions)) {
                $whereClause = 'WHERE ' . implode(' AND ', $conditions);
            }
            
            // Count total matching courses for pagination
            $countSql = "SELECT COUNT(c.id)
                         FROM {course} c
                         $whereClause";
            
            $total = $DB->count_records_sql($countSql, $params);
            
            // Calculate pagination values
            $totalPages = ceil($total / $perPage);
            $offset = ($page - 1) * $perPage;
            
            // Build main SQL query with enrollment count subquery
            $sql = "SELECT c.id,
                           c.fullname,
                           c.shortname,
                           c.category,
                           cc.name as categoryname,
                           c.visible,
                           c.startdate,
                           c.enddate,
                           c.format,
                           c.summary,
                           c.summaryformat,
                           (SELECT COUNT(*)
                            FROM {user_enrolments} ue
                            JOIN {enrol} e ON ue.enrolid = e.id
                            WHERE e.courseid = c.id) as enrollmentcount
                    FROM {course} c
                    LEFT JOIN {course_categories} cc ON c.category = cc.id
                    $whereClause
                    ORDER BY c.$sortBy $sortOrder";
            
            // Execute main query with pagination
            $courseRecords = $DB->get_records_sql($sql, $params, $offset, $perPage);
            
            // Format course data for response
            $courses = [];
            foreach ($courseRecords as $record) {
                $courses[] = [
                    'id' => (int)$record->id,
                    'fullname' => $record->fullname,
                    'shortname' => $record->shortname,
                    'category' => (int)$record->category,
                    'categoryname' => $record->categoryname ?? '',
                    'visible' => (bool)$record->visible,
                    'startdate' => (int)$record->startdate,
                    'enddate' => (int)$record->enddate,
                    'format' => $record->format,
                    'summary' => $record->summary ?? '',
                    'summaryformat' => (int)$record->summaryformat,
                    'enrollmentcount' => (int)$record->enrollmentcount,
                ];
            }
            
            // Format pagination metadata
            $pagination = ApiResponse::formatPagination($page, $perPage, $total);
            
            // Return success response with courses data and pagination
            $this->success(
                ['courses' => $courses],
                200,
                ['pagination' => $pagination]
            );
            
        } catch (dml_exception $e) {
            // Convert database exceptions to ServerException
            throw new ServerException(
                'Database error while retrieving courses',
                [
                    'originalError' => $e->getMessage(),
                    'operation' => 'get_courses_list'
                ]
            );
        }
    }
}

// Execute the endpoint
$endpoint = new AdminCoursesIndexEndpoint();
$endpoint->execute();
