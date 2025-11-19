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
 * GET /api/v1/gradebook/categories - Retrieve grade category hierarchy for a course
 *
 * This endpoint retrieves the grade category structure for a course including
 * category hierarchy, aggregation methods, weights, and nested children. It wraps
 * existing Moodle grade category functions to provide a JSON API interface.
 *
 * Required Parameters:
 * - courseid: The ID of the course (integer)
 *
 * Required Capability:
 * - moodle/grade:view in course context
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
 *     "root_category": {
 *       "id": 1,
 *       "name": "Course Name",
 *       "aggregation": 13,
 *       "aggregation_name": "Weighted mean of grades",
 *       "aggregationcoef": 0.00,
 *       "aggregationcoef2": 0.00,
 *       "droplow": 0,
 *       "keephigh": 0,
 *       "hidden": 0,
 *       "parent": null,
 *       "depth": 1,
 *       "path": "/1/",
 *       "children": [
 *         {
 *           "type": "category",
 *           "id": 2,
 *           "name": "Assignments",
 *           "aggregation": 10,
 *           "children": []
 *         },
 *         {
 *           "type": "item",
 *           "id": 3,
 *           "itemname": "Final Exam",
 *           "itemtype": "manual"
 *         }
 *       ]
 *     }
 *   }
 * }
 *
 * @package    core_grades
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Always load API base classes (needed for class definition)
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');
require_once(__DIR__ . '/../../lib/api_response.php');

// Define constants before loading config (they must be set before setup.php runs)
// In test mode, config is already loaded by test script
// In production, we need to load it here
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    define('AJAX_SCRIPT', true);
    define('NO_MOODLE_COOKIES', true);
    require_once(__DIR__ . '/../../../public/config.php');
    global $CFG;
    
    // Load Moodle grade libraries
    require_once($CFG->libdir . '/gradelib.php');
} else {
    // In test mode, only define if not already defined (config was pre-loaded)
    if (!defined('AJAX_SCRIPT')) {
        define('AJAX_SCRIPT', true);
    }
    if (!defined('NO_MOODLE_COOKIES')) {
        define('NO_MOODLE_COOKIES', true);
    }
}

/**
 * Grade Categories Endpoint Class
 *
 * Handles GET requests to retrieve grade category hierarchy for a course.
 * Wraps existing Moodle grade_category methods following thin wrapper pattern.
 *
 * @package    core_grades
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class GradeCategoriesEndpoint extends ApiBase {
    
    /**
     * Get human-readable name for aggregation type
     *
     * Maps Moodle aggregation constants to descriptive names.
     *
     * @param int $aggregation Aggregation constant from Moodle core
     * @return string Human-readable aggregation method name
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
     * Recursively build category tree structure with children
     *
     * Uses the existing grade_category::get_children() method to retrieve
     * nested categories and grade items. Follows the thin wrapper pattern
     * by delegating all data retrieval to Moodle core functions.
     *
     * @param grade_category $category The category to process
     * @return array Category data with nested children array
     */
    private function buildCategoryTree($category) {
        // Build base category data structure
        $categorydata = [
            'id' => intval($category->id),
            'name' => $category->get_name(),
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
            'timecreated' => intval($category->timecreated),
            'timemodified' => intval($category->timemodified)
        ];
        
        // Recursively get all children using existing Moodle method
        $children = $category->get_children();
        $categorydata['children'] = [];
        
        if ($children) {
            foreach ($children as $child) {
                // Check if child is a category or grade item
                if ($child instanceof grade_category) {
                    // Recursively process child category
                    $childdata = $this->buildCategoryTree($child);
                    $childdata['type'] = 'category';
                    $categorydata['children'][] = $childdata;
                } else if ($child instanceof grade_item) {
                    // Process grade item (leaf node)
                    $itemdata = [
                        'type' => 'item',
                        'id' => intval($child->id),
                        'itemname' => $child->itemname,
                        'itemtype' => $child->itemtype,
                        'itemmodule' => $child->itemmodule,
                        'iteminstance' => $child->iteminstance ? intval($child->iteminstance) : null,
                        'itemnumber' => $child->itemnumber ? intval($child->itemnumber) : null,
                        'idnumber' => $child->idnumber,
                        'calculation' => $child->calculation,
                        'gradetype' => intval($child->gradetype),
                        'grademax' => floatval($child->grademax),
                        'grademin' => floatval($child->grademin),
                        'gradepass' => floatval($child->gradepass),
                        'multfactor' => floatval($child->multfactor),
                        'plusfactor' => floatval($child->plusfactor),
                        'aggregationcoef' => floatval($child->aggregationcoef),
                        'aggregationcoef2' => floatval($child->aggregationcoef2),
                        'hidden' => intval($child->hidden),
                        'locked' => intval($child->locked),
                        'weightoverride' => intval($child->weightoverride),
                        'needsupdate' => intval($child->needsupdate)
                    ];
                    $categorydata['children'][] = $itemdata;
                }
            }
        }
        
        return $categorydata;
    }
    
    /**
     * Handle POST request - not supported for this read-only endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always throws since POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for grade categories endpoint');
    }
    
    /**
     * Handle PUT request - not supported for this read-only endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always throws since PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for grade categories endpoint');
    }
    
    /**
     * Handle DELETE request - not supported for this read-only endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always throws since DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for grade categories endpoint');
    }
    
    /**
     * Handle GET request to retrieve grade category hierarchy
     *
     * Implements the required endpoint logic:
     * 1. Extract and validate courseid parameter
     * 2. Verify course exists
     * 3. Check moodle/grade:view capability in course context
     * 4. Call grade_category::fetch_course_category() to get root category
     * 5. Recursively build category tree using get_children()
     * 6. Return JSON-formatted hierarchical structure
     *
     * All business logic is delegated to existing Moodle grade_category methods.
     * No grade calculation or permission logic is duplicated.
     *
     * @return void Outputs JSON response via ApiResponse::success()
     * @throws NotFoundException If course not found (404)
     * @throws ForbiddenException If user lacks permission (403)
     * @throws ValidationException If courseid parameter invalid (400)
     */
    protected function handle_get() {
        global $DB;
        
        // Extract required courseid parameter using ApiBase method
        $courseid = $this->getParam('courseid', PARAM_INT);
        
        // Validate courseid is provided
        if (empty($courseid)) {
            throw new ValidationException('Required parameter courseid is missing');
        }
        
        // Verify course exists using Moodle database API
        $course = $DB->get_record('course', ['id' => $courseid]);
        if (!$course) {
            throw new NotFoundException('Course not found');
        }
        
        // Get course context for capability checking
        $context = context_course::instance($course->id);
        
        // Check permission using ApiBase method which wraps require_capability()
        // This enforces moodle/grade:view capability in course context
        $this->checkCapability('moodle/grade:view', $context);
        
        // Call existing Moodle static method to fetch root course category
        // This is the entry point specified in requirements
        $rootcategory = grade_category::fetch_course_category($courseid);
        
        // Handle case where category fetch returns false (should not happen for valid course)
        if (!$rootcategory) {
            throw new NotFoundException('Grade category not found for this course');
        }
        
        // Recursively build category tree using get_children() method
        // This delegates all structure retrieval to existing grade_category methods
        $categorytree = $this->buildCategoryTree($rootcategory);
        
        // Build complete response with course info and category hierarchy
        $response = [
            'course' => [
                'id' => intval($course->id),
                'fullname' => $course->fullname,
                'shortname' => $course->shortname,
                'idnumber' => $course->idnumber
            ],
            'root_category' => $categorytree
        ];
        
        // Return standardized JSON success response
        $this->success($response);
    }
    
}

// Instantiate endpoint and execute request
// ApiBase::execute() will route to handle_get() for GET requests
// and handle authentication, error handling, and response formatting
// Guard against execution in test mode to allow unit testing
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new GradeCategoriesEndpoint();
    $endpoint->execute();
}
