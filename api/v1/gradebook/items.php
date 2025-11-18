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
 * configured in a course's gradebook. Wraps existing grade_item::fetch_all() from gradelib.php
 * to return JSON-formatted list of grade items with comprehensive properties including names,
 * categories, grade ranges, scales, item types, and aggregation settings.
 *
 * Required Parameters:
 * - courseid: The ID of the course (integer)
 *
 * Optional Parameters:
 * - include_categories: Include grade category items (boolean, default: false)
 * - include_course_item: Include course total item (boolean, default: false)
 *
 * Required Capability: moodle/grade:view
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 10,
 *       "courseid": 5,
 *       "itemname": "Assignment 1",
 *       "itemtype": "mod",
 *       "itemmodule": "assign",
 *       "iteminstance": 15,
 *       "categoryid": 3,
 *       "categoryname": "Assignments",
 *       "gradetype": 1,
 *       "grademax": 100.00,
 *       "grademin": 0.00,
 *       "gradepass": 50.00,
 *       "scaleid": null,
 *       "locked": false,
 *       "hidden": false,
 *       "aggregationcoef": 0.00,
 *       "aggregationcoef2": 0.00,
 *       "weightoverride": 0,
 *       "sortorder": 1,
 *       "display": 1,
 *       "decimals": 2,
 *       "timecreated": 1234567890,
 *       "timemodified": 1234567890
 *     }
 *   ]
 * }
 *
 * Error Responses:
 * - 400: Missing or invalid courseid parameter
 * - 403: Permission denied (missing moodle/grade:view capability)
 * - 404: Course not found
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Define constants for API context
define('AJAX_SCRIPT', true);
define('NO_MOODLE_COOKIES', true);

// Load Moodle configuration and required libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/gradelib.php');
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * Grade Items Endpoint Class
 *
 * Handles GET requests to retrieve all grade items for a course.
 * Extends ApiBase to inherit JWT authentication, permission checking,
 * parameter extraction, and response formatting.
 *
 * @package    core
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class GradeItemsEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve grade items for a course.
     *
     * Thin wrapper around existing Moodle grading functions. Performs the following:
     * 1. Extracts and validates courseid parameter
     * 2. Verifies course exists and user has moodle/grade:view capability
     * 3. Calls grade_item::fetch_all() to retrieve grade items (existing function)
     * 4. Filters out GRADE_TYPE_NONE items and optionally category/course items
     * 5. Enriches items with formatted names and category information
     * 6. Returns JSON response with grade item data
     *
     * No business logic duplication - all grade retrieval uses existing Moodle functions.
     *
     * @return void Outputs JSON response directly via $this->success()
     * @throws ValidationException If courseid parameter is missing or invalid
     * @throws NotFoundException If course does not exist
     * @throws ForbiddenException If user lacks moodle/grade:view capability
     */
    protected function handle_get() {
        global $DB;
        
        // Extract and validate required courseid parameter
        $courseid = $this->getParam('courseid', PARAM_INT, true);
        
        // Extract optional filter parameters
        $includecategories = $this->getParam('include_categories', PARAM_BOOL, false, false);
        $includecourseitem = $this->getParam('include_course_item', PARAM_BOOL, false, false);
        
        // Verify course exists using existing Moodle database query
        $course = $DB->get_record('course', ['id' => $courseid]);
        
        if (!$course) {
            $this->error(
                'COURSE_NOT_FOUND',
                'The specified course does not exist',
                404,
                ['courseid' => $courseid]
            );
            return;
        }
        
        // Get course context for capability checking
        $context = context_course::instance($courseid);
        
        // Check user has permission to view grades in this course
        // Uses existing Moodle require_capability() via ApiBase->checkCapability()
        $this->checkCapability('moodle/grade:view', $context);
        
        // Retrieve all grade items for the course using existing Moodle function
        // grade_item::fetch_all() is the authoritative source for grade item data
        $gradeitems = grade_item::fetch_all(['courseid' => $courseid]);
        
        // Initialize array for filtered and enriched grade items
        $items = [];
        
        // Process grade items if any exist
        if ($gradeitems) {
            foreach ($gradeitems as $gradeitem) {
                // Filter out items with GRADE_TYPE_NONE (not actual grade items)
                if ($gradeitem->gradetype == GRADE_TYPE_NONE) {
                    continue;
                }
                
                // Filter out category items unless explicitly requested
                if (!$includecategories && $gradeitem->is_category_item()) {
                    continue;
                }
                
                // Filter out course total item unless explicitly requested
                if (!$includecourseitem && $gradeitem->is_course_item()) {
                    continue;
                }
                
                // Build enriched item data using existing grade_item methods
                $itemdata = [
                    'id' => (int)$gradeitem->id,
                    'courseid' => (int)$gradeitem->courseid,
                    // Use get_name() method for formatted display name
                    'itemname' => $gradeitem->get_name(),
                    'itemtype' => $gradeitem->itemtype,
                    'itemmodule' => $gradeitem->itemmodule,
                    'iteminstance' => $gradeitem->iteminstance ? (int)$gradeitem->iteminstance : null,
                    'itemnumber' => $gradeitem->itemnumber ? (int)$gradeitem->itemnumber : 0,
                    'categoryid' => (int)$gradeitem->categoryid,
                    // Use get_parent_category() method to get category object, then get_name()
                    'categoryname' => $gradeitem->get_parent_category()->get_name(),
                    'gradetype' => (int)$gradeitem->gradetype,
                    'grademax' => (float)$gradeitem->grademax,
                    'grademin' => (float)$gradeitem->grademin,
                    'gradepass' => $gradeitem->gradepass ? (float)$gradeitem->gradepass : null,
                    'scaleid' => $gradeitem->scaleid ? (int)$gradeitem->scaleid : null,
                    // Use is_locked() method to check lock status
                    'locked' => $gradeitem->is_locked(),
                    // Use is_hidden() method to check visibility status
                    'hidden' => $gradeitem->is_hidden(),
                    'aggregationcoef' => (float)$gradeitem->aggregationcoef,
                    'aggregationcoef2' => (float)$gradeitem->aggregationcoef2,
                    'weightoverride' => (int)$gradeitem->weightoverride,
                    'sortorder' => (int)$gradeitem->sortorder,
                    'display' => (int)$gradeitem->display,
                    'decimals' => $gradeitem->decimals !== null ? (int)$gradeitem->decimals : null,
                    'multfactor' => (float)$gradeitem->multfactor,
                    'plusfactor' => (float)$gradeitem->plusfactor,
                    'timecreated' => (int)$gradeitem->timecreated,
                    'timemodified' => (int)$gradeitem->timemodified
                ];
                
                // Add scale information if this grade item uses a scale
                if ($gradeitem->gradetype == GRADE_TYPE_SCALE && $gradeitem->scaleid) {
                    $scale = $DB->get_record('scale', ['id' => $gradeitem->scaleid]);
                    if ($scale) {
                        $itemdata['scale'] = [
                            'id' => (int)$scale->id,
                            'name' => $scale->name,
                            'scale' => $scale->scale,
                            'description' => $scale->description
                        ];
                    }
                }
                
                // Add outcome information if this is an outcome item
                if ($gradeitem->itemtype === 'outcome' && $gradeitem->outcomeid) {
                    // Use grade_outcome::fetch() to get outcome details (existing function)
                    $outcome = grade_outcome::fetch(['id' => $gradeitem->outcomeid]);
                    if ($outcome) {
                        $itemdata['outcome'] = [
                            'id' => (int)$outcome->id,
                            'shortname' => $outcome->shortname,
                            'fullname' => $outcome->fullname,
                            'description' => $outcome->description
                        ];
                    }
                }
                
                // Add calculation formula if present
                if (!empty($gradeitem->calculation)) {
                    $itemdata['calculation'] = $gradeitem->calculation;
                }
                
                $items[] = $itemdata;
            }
        }
        
        // Return success response with grade items array
        // Uses ApiBase->success() for consistent JSON formatting
        $this->success($items);
    }
    
    /**
     * Handle POST request - not supported for this endpoint.
     *
     * Grade items are managed through course activities and manual grade items,
     * not created directly through this API endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for grade items retrieval endpoint');
    }
    
    /**
     * Handle PUT request - not supported for this endpoint.
     *
     * Grade item updates should use dedicated update endpoints for specific
     * item types (assignments, quizzes, manual items, etc.).
     *
     * @return void
     * @throws MethodNotAllowedException Always throws
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for grade items retrieval endpoint');
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint.
     *
     * Grade items are deleted through their parent activities or through
     * the gradebook management interface, not directly via this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for grade items retrieval endpoint');
    }
}

// Instantiate and execute the endpoint (skip in test mode)
if (!defined('API_TEST_MODE')) {
    $endpoint = new GradeItemsEndpoint();
    $endpoint->execute();
}
