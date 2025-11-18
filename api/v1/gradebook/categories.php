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
 * Grade Categories API Endpoint
 *
 * GET /api/v1/gradebook/categories - Get all grade categories for a course
 *
 * This endpoint provides access to all grade categories configured in a course's
 * gradebook, including their hierarchical structure, aggregation settings, and
 * weighting rules.
 *
 * Required Parameters:
 * - courseid: The ID of the course
 *
 * Optional Parameters:
 * - includetree: Return categories in tree structure (default: false)
 *
 * Required Capability: moodle/grade:view or moodle/grade:viewall
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "course": {
 *       "id": 5,
 *       "fullname": "Course Name",
 *       "shortname": "COURSE101"
 *     },
 *     "categories": [
 *       {
 *         "id": 1,
 *         "fullname": "?",
 *         "aggregation": 13,
 *         "aggregation_name": "Weighted mean of grades",
 *         "aggregationcoef": 0.00,
 *         "aggregationcoef2": 0.00,
 *         "aggregateonlygraded": 1,
 *         "aggregateoutcomes": 0,
 *         "droplow": 0,
 *         "keephigh": 0,
 *         "hidden": 0,
 *         "parent": null,
 *         "depth": 1,
 *         "path": "/1/",
 *         "children": [2, 3],
 *         "item_count": 5
 *       }
 *     ]
 *   }
 * }
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('AJAX_SCRIPT', true);
define('NO_MOODLE_COOKIES', true);

require_once(__DIR__ . '/../../../public/config.php');
require_once($CFG->libdir . '/gradelib.php');
require_once($CFG->dirroot . '/grade/lib.php');
require_once($CFG->dirroot . '/grade/querylib.php');
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');
require_once(__DIR__ . '/../../lib/api_response.php');

/**
 * Grade Categories Endpoint Class
 *
 * Handles GET requests to retrieve all grade categories for a course.
 *
 * @package    core
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class GradeCategoriesEndpoint extends ApiBase {
    
    /**
     * Get human-readable name for aggregation type
     *
     * @param int $aggregation Aggregation constant
     * @return string Aggregation name
     */
    private function get_aggregation_name($aggregation) {
        $names = [
            GRADE_AGGREGATE_MEAN => 'Mean of grades',
            GRADE_AGGREGATE_WEIGHTED_MEAN => 'Weighted mean of grades',
            GRADE_AGGREGATE_WEIGHTED_MEAN2 => 'Simple weighted mean of grades',
            GRADE_AGGREGATE_EXTRACREDIT_MEAN => 'Mean of grades (with extra credits)',
            GRADE_AGGREGATE_MEDIAN => 'Median of grades',
            GRADE_AGGREGATE_MIN => 'Lowest grade',
            GRADE_AGGREGATE_MAX => 'Highest grade',
            GRADE_AGGREGATE_MODE => 'Mode of grades',
            GRADE_AGGREGATE_SUM => 'Sum of grades'
        ];
        
        return $names[$aggregation] ?? 'Unknown';
    }
    
    /**
     * Build tree structure from flat category list
     *
     * @param array $categories Flat array of categories
     * @return array Tree structure with children
     */
    private function build_category_tree($categories) {
        $tree = [];
        $indexed = [];
        
        // Index categories by id
        foreach ($categories as $category) {
            $indexed[$category['id']] = $category;
            $indexed[$category['id']]['children_data'] = [];
        }
        
        // Build tree structure
        foreach ($indexed as $id => $category) {
            if ($category['parent'] === null) {
                // Root category
                $tree[] = &$indexed[$id];
            } else {
                // Child category
                if (isset($indexed[$category['parent']])) {
                    $indexed[$category['parent']]['children_data'][] = &$indexed[$id];
                }
            }
        }
        
        return $tree;
    }
    
    /**
     * Handle GET request to retrieve grade categories
     *
     * Validates permissions, retrieves all grade categories for a course,
     * and returns formatted category configuration data with optional tree structure.
     *
     * @return void Outputs JSON response
     * @throws ApiException If validation fails or course not found
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Extract and validate parameters
        $courseid = required_param('courseid', PARAM_INT);
        $includetree = optional_param('includetree', false, PARAM_BOOL);
        
        // Verify course exists
        $course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);
        if (!$course) {
            throw new ApiException('Course not found', 'COURSE_NOT_FOUND', 404);
        }
        
        // Get course context
        $context = context_course::instance($course->id);
        
        // Validate JWT token and get authenticated user
        $userid = $this->authenticate_request();
        
        // Check permission to view grades in this course
        if (!has_capability('moodle/grade:view', $context) && 
            !has_capability('moodle/grade:viewall', $context)) {
            throw new ApiException(
                'You do not have permission to view grades in this course',
                'PERMISSION_DENIED',
                403
            );
        }
        
        // Get all grade categories for this course
        $categories = grade_category::fetch_all(['courseid' => $courseid]);
        $categoriesdata = [];
        
        if ($categories) {
            foreach ($categories as $category) {
                // Get child categories
                $children = [];
                $childcategories = $DB->get_records('grade_categories', ['parent' => $category->id], '', 'id');
                if ($childcategories) {
                    $children = array_keys($childcategories);
                }
                
                // Count grade items in this category
                $itemcount = $DB->count_records('grade_items', [
                    'courseid' => $courseid,
                    'categoryid' => $category->id
                ]);
                
                $categorydata = [
                    'id' => intval($category->id),
                    'fullname' => $category->get_name(),
                    'aggregation' => intval($category->aggregation),
                    'aggregation_name' => $this->get_aggregation_name($category->aggregation),
                    'aggregationcoef' => floatval($category->aggregationcoef),
                    'aggregationcoef2' => floatval($category->aggregationcoef2),
                    'aggregateonlygraded' => intval($category->aggregateonlygraded),
                    'aggregateoutcomes' => intval($category->aggregateoutcomes),
                    'droplow' => intval($category->droplow),
                    'keephigh' => intval($category->keephigh),
                    'hidden' => intval($category->hidden),
                    'parent' => $category->parent ? intval($category->parent) : null,
                    'depth' => intval($category->depth),
                    'path' => $category->path,
                    'children' => $children,
                    'item_count' => $itemcount,
                    'timecreated' => intval($category->timecreated),
                    'timemodified' => intval($category->timemodified)
                ];
                
                $categoriesdata[] = $categorydata;
            }
        }
        
        // Build tree structure if requested
        if ($includetree) {
            $categoriesdata = $this->build_category_tree($categoriesdata);
        }
        
        // Build response
        $response = [
            'course' => [
                'id' => $course->id,
                'fullname' => $course->fullname,
                'shortname' => $course->shortname,
                'idnumber' => $course->idnumber
            ],
            'categories' => $categoriesdata,
            'is_tree' => $includetree
        ];
        
        ApiResponse::success($response);
    }
    
    /**
     * Handle POST request - not supported for this endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for grade categories endpoint');
    }
    
    /**
     * Handle PUT request - not supported for this endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for grade categories endpoint');
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for grade categories endpoint');
    }
}

// Instantiate and handle the request
if (!defined('API_TEST_MODE')) {
    $endpoint = new GradeCategoriesEndpoint();
    $endpoint->handle_request();
}
