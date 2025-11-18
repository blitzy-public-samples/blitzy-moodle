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
 * Grade Items API Endpoint
 *
 * GET /api/v1/gradebook/items - Get all grade items for a course
 *
 * This endpoint provides access to all grade items (assignments, quizzes, manual items, etc.)
 * configured in a course's gradebook, including their properties, weightings, and settings.
 *
 * Required Parameters:
 * - courseid: The ID of the course
 *
 * Optional Parameters:
 * - includeoutcomes: Include outcome items (default: false)
 * - includecategories: Include grade category items (default: true)
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
 *     "items": [
 *       {
 *         "id": 10,
 *         "itemname": "Assignment 1",
 *         "itemtype": "mod",
 *         "itemmodule": "assign",
 *         "iteminstance": 5,
 *         "categoryid": 3,
 *         "grademax": 100.00,
 *         "grademin": 0.00,
 *         "gradepass": 50.00,
 *         "multfactor": 1.00,
 *         "plusfactor": 0.00,
 *         "aggregationcoef": 0.00,
 *         "aggregationcoef2": 0.00,
 *         "weightoverride": 0,
 *         "sortorder": 1,
 *         "display": 1,
 *         "decimals": 2,
 *         "hidden": 0,
 *         "locked": 0,
 *         "locktime": 0,
 *         "needsupdate": 0,
 *         "calculation": null
 *       }
 *     ],
 *     "categories": [
 *       {
 *         "id": 3,
 *         "fullname": "Assignments",
 *         "aggregation": 10,
 *         "aggregationcoef": 0.00,
 *         "aggregationcoef2": 0.00,
 *         "aggregateonlygraded": 1,
 *         "aggregateoutcomes": 0,
 *         "droplow": 0,
 *         "keephigh": 0,
 *         "parent": 1
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
 * Grade Items Endpoint Class
 *
 * Handles GET requests to retrieve all grade items for a course.
 *
 * @package    core
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class GradeItemsEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve grade items
     *
     * Validates permissions, retrieves all grade items and categories for a course,
     * and returns formatted grade item configuration data.
     *
     * @return void Outputs JSON response
     * @throws ApiException If validation fails or course not found
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Extract and validate parameters
        $courseid = required_param('courseid', PARAM_INT);
        $includeoutcomes = optional_param('includeoutcomes', false, PARAM_BOOL);
        $includecategories = optional_param('includecategories', true, PARAM_BOOL);
        
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
        // Users need either view (own grades) or viewall (all grades) capability
        if (!has_capability('moodle/grade:view', $context) && 
            !has_capability('moodle/grade:viewall', $context)) {
            throw new ApiException(
                'You do not have permission to view grades in this course',
                'PERMISSION_DENIED',
                403
            );
        }
        
        // Get all grade items for this course
        $gradeitems = grade_item::fetch_all(['courseid' => $courseid]);
        $gradeitemsdata = [];
        
        if ($gradeitems) {
            foreach ($gradeitems as $gradeitem) {
                // Skip outcomes if not requested
                if (!$includeoutcomes && $gradeitem->itemtype == 'outcome') {
                    continue;
                }
                
                // Skip course item (it's not a real gradeable item)
                if ($gradeitem->itemtype == 'course') {
                    continue;
                }
                
                // Skip category items if not requested
                if (!$includecategories && $gradeitem->itemtype == 'category') {
                    continue;
                }
                
                $itemdata = [
                    'id' => intval($gradeitem->id),
                    'itemname' => $gradeitem->get_name(),
                    'itemtype' => $gradeitem->itemtype,
                    'itemmodule' => $gradeitem->itemmodule,
                    'iteminstance' => $gradeitem->iteminstance ? intval($gradeitem->iteminstance) : null,
                    'categoryid' => intval($gradeitem->categoryid),
                    'grademax' => floatval($gradeitem->grademax),
                    'grademin' => floatval($gradeitem->grademin),
                    'gradepass' => $gradeitem->gradepass ? floatval($gradeitem->gradepass) : null,
                    'multfactor' => floatval($gradeitem->multfactor),
                    'plusfactor' => floatval($gradeitem->plusfactor),
                    'aggregationcoef' => floatval($gradeitem->aggregationcoef),
                    'aggregationcoef2' => floatval($gradeitem->aggregationcoef2),
                    'weightoverride' => intval($gradeitem->weightoverride),
                    'sortorder' => intval($gradeitem->sortorder),
                    'display' => intval($gradeitem->display),
                    'decimals' => $gradeitem->decimals !== null ? intval($gradeitem->decimals) : null,
                    'hidden' => intval($gradeitem->hidden),
                    'locked' => intval($gradeitem->locked),
                    'locktime' => intval($gradeitem->locktime),
                    'needsupdate' => intval($gradeitem->needsupdate),
                    'calculation' => $gradeitem->calculation,
                    'timecreated' => intval($gradeitem->timecreated),
                    'timemodified' => intval($gradeitem->timemodified)
                ];
                
                // Add outcome-specific data if this is an outcome
                if ($gradeitem->itemtype == 'outcome' && $gradeitem->outcomeid) {
                    $outcome = grade_outcome::fetch(['id' => $gradeitem->outcomeid]);
                    if ($outcome) {
                        $itemdata['outcome'] = [
                            'id' => intval($outcome->id),
                            'shortname' => $outcome->shortname,
                            'fullname' => $outcome->fullname,
                            'scaleid' => intval($outcome->scaleid)
                        ];
                    }
                }
                
                // Add scale information if this item uses a scale
                if ($gradeitem->gradetype == GRADE_TYPE_SCALE && $gradeitem->scaleid) {
                    $scale = $DB->get_record('scale', ['id' => $gradeitem->scaleid]);
                    if ($scale) {
                        $itemdata['scale'] = [
                            'id' => intval($scale->id),
                            'name' => $scale->name,
                            'scale' => $scale->scale
                        ];
                    }
                }
                
                $gradeitemsdata[] = $itemdata;
            }
        }
        
        // Get grade categories for this course
        $categories = grade_category::fetch_all(['courseid' => $courseid]);
        $categoriesdata = [];
        
        if ($categories) {
            foreach ($categories as $category) {
                $categoriesdata[] = [
                    'id' => intval($category->id),
                    'fullname' => $category->get_name(),
                    'aggregation' => intval($category->aggregation),
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
            }
        }
        
        // Build response
        $response = [
            'course' => [
                'id' => $course->id,
                'fullname' => $course->fullname,
                'shortname' => $course->shortname,
                'idnumber' => $course->idnumber
            ],
            'items' => $gradeitemsdata,
            'categories' => $categoriesdata
        ];
        
        ApiResponse::success($response);
    }
    
    /**
     * Handle POST request - not supported for this endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always throws
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for grade items endpoint');
    }
    
    /**
     * Handle PUT request - not supported for this endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always throws
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for grade items endpoint');
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint
     *
     * @return void
     * @throws MethodNotAllowedException Always throws
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for grade items endpoint');
    }
}

// Instantiate and handle the request
if (!defined('API_TEST_MODE')) {
    $endpoint = new GradeItemsEndpoint();
    $endpoint->execute();
}
