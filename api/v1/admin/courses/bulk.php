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
 * REST API endpoint for bulk course operations.
 *
 * Handles bulk hide/show/delete operations on multiple courses simultaneously.
 * This endpoint is restricted to users with site administration capabilities
 * (moodle/site:config) and provides atomic processing of multiple course IDs.
 *
 * Supported operations:
 * - 'hide': Sets course visibility to hidden (visible=0) for all specified courses
 * - 'show': Sets course visibility to visible (visible=1) for all specified courses
 * - 'delete': Permanently deletes all specified courses and their contents
 *
 * Request format:
 * POST /api/v1/admin/courses/bulk
 * Content-Type: application/json
 * Authorization: Bearer <jwt_token>
 * 
 * {
 *   "action": "hide|show|delete",
 *   "courseids": [1, 2, 3, 4, 5]
 * }
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "results": [
 *       {"courseid": 1, "status": "success", "message": "Course hidden successfully"},
 *       {"courseid": 2, "status": "error", "message": "Course not found"},
 *       {"courseid": 3, "status": "success", "message": "Course hidden successfully"}
 *     ]
 *   }
 * }
 *
 * Implementation follows thin wrapper pattern by delegating to existing Moodle
 * core functions (update_course, delete_course) without reimplementing business
 * logic. All permission checks, validation, and database operations are handled
 * by existing Moodle functions.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include API base class and exception handling
require_once(__DIR__ . '/../../../lib/api_base.php');
require_once(__DIR__ . '/../../../lib/api_exception.php');

// Include Moodle course library functions
global $CFG;
require_once($CFG->libdir . '/moodlelib.php');
require_once($CFG->libdir . '/datalib.php');
require_once($CFG->dirroot . '/course/lib.php');

/**
 * Bulk course operations API endpoint.
 *
 * Extends ApiBase to provide bulk operations on multiple courses. Validates
 * JWT authentication, enforces admin capabilities, processes each course ID
 * with appropriate error handling, and returns detailed results for each course.
 */
class BulkCourseOperationsEndpoint extends ApiBase {
    
    /**
     * Handle POST request for bulk course operations.
     *
     * Processes JSON request body containing action type and array of course IDs.
     * Validates input parameters, enforces admin capabilities, delegates to existing
     * Moodle functions for each course, collects success/error results, and calls
     * fix_course_sortorder() after all operations complete.
     *
     * Supported actions:
     * - hide: Set visible=0 using update_course()
     * - show: Set visible=1 using update_course()
     * - delete: Call delete_course() after validation
     *
     * @return void Outputs JSON response via success() method
     * @throws ValidationException If request body is invalid or missing required fields
     * @throws ForbiddenException If user lacks moodle/site:config capability
     */
    protected function handle_post() {
        global $DB;
        
        // Parse JSON request body
        $data = $this->getJsonBody();
        
        // Validate required field: action
        if (!isset($data['action']) || empty($data['action'])) {
            throw new ValidationException('Missing required field: action', [
                'field' => 'action',
                'required' => true,
                'allowedValues' => ['hide', 'show', 'delete']
            ]);
        }
        
        // Validate required field: courseids array
        if (!isset($data['courseids']) || !is_array($data['courseids'])) {
            throw new ValidationException('Missing or invalid field: courseids', [
                'field' => 'courseids',
                'required' => true,
                'expectedType' => 'array',
                'receivedType' => gettype($data['courseids'] ?? null)
            ]);
        }
        
        // Validate courseids array is not empty
        if (empty($data['courseids'])) {
            throw new ValidationException('courseids array cannot be empty', [
                'field' => 'courseids',
                'reason' => 'At least one course ID is required for bulk operations'
            ]);
        }
        
        // Extract and validate action
        $action = trim($data['action']);
        $allowedActions = ['hide', 'show', 'delete'];
        
        if (!in_array($action, $allowedActions)) {
            throw new ValidationException('Invalid action specified', [
                'field' => 'action',
                'received' => $action,
                'allowedValues' => $allowedActions,
                'reason' => 'Action must be one of: hide, show, delete'
            ]);
        }
        
        // Extract course IDs array
        $courseids = $data['courseids'];
        
        // Enforce admin capability requirement
        // moodle/site:config is required for bulk course operations
        $systemContext = context_system::instance();
        $this->checkCapability('moodle/site:config', $systemContext);
        
        // Initialize results array to collect outcomes for each course
        $results = [];
        
        // Process each course ID based on action type
        switch ($action) {
            case 'hide':
                $results = $this->processBulkHide($courseids);
                break;
                
            case 'show':
                $results = $this->processBulkShow($courseids);
                break;
                
            case 'delete':
                $results = $this->processBulkDelete($courseids);
                break;
        }
        
        // Fix course sort order after all operations complete
        // This ensures database integrity and correct course ordering
        try {
            fix_course_sortorder();
        } catch (Exception $e) {
            // Log error but don't fail the request since operations completed
            error_log('Warning: fix_course_sortorder() failed after bulk operations: ' . $e->getMessage());
        }
        
        // Return success response with results array
        $this->success([
            'results' => $results
        ]);
    }
    
    /**
     * Process bulk hide operation for multiple courses.
     *
     * Iterates through course IDs, validates each course exists, checks permissions,
     * sets visible=0, and calls update_course() for each. Collects success/error
     * status for each course ID.
     *
     * @param array $courseids Array of course IDs to hide
     * @return array Results array with status for each course
     */
    private function processBulkHide($courseids) {
        global $DB;
        
        $results = [];
        
        foreach ($courseids as $courseid) {
            // Validate course ID is numeric
            if (!is_numeric($courseid)) {
                $results[] = [
                    'courseid' => $courseid,
                    'status' => 'error',
                    'message' => 'Invalid course ID: must be numeric'
                ];
                continue;
            }
            
            $courseid = (int)$courseid;
            
            try {
                // Retrieve course record from database
                $course = $DB->get_record('course', ['id' => $courseid]);
                
                if (!$course) {
                    $results[] = [
                        'courseid' => $courseid,
                        'status' => 'error',
                        'message' => 'Course not found'
                    ];
                    continue;
                }
                
                // Prevent operations on site course (front page)
                if ($course->id == SITEID) {
                    $results[] = [
                        'courseid' => $courseid,
                        'status' => 'error',
                        'message' => 'Cannot modify site course'
                    ];
                    continue;
                }
                
                // Get course context for permission checks
                $context = context_course::instance($courseid);
                
                // Set course visibility to hidden
                $course->visible = 0;
                
                // Call existing Moodle function to update course
                // This handles all validation, triggers, events, and caching
                update_course($course);
                
                $results[] = [
                    'courseid' => $courseid,
                    'status' => 'success',
                    'message' => 'Course hidden successfully'
                ];
                
            } catch (moodle_exception $e) {
                // Catch Moodle exceptions from update_course()
                $results[] = [
                    'courseid' => $courseid,
                    'status' => 'error',
                    'message' => $e->getMessage()
                ];
                
            } catch (Exception $e) {
                // Catch unexpected exceptions
                $results[] = [
                    'courseid' => $courseid,
                    'status' => 'error',
                    'message' => 'Unexpected error: ' . $e->getMessage()
                ];
            }
        }
        
        return $results;
    }
    
    /**
     * Process bulk show operation for multiple courses.
     *
     * Iterates through course IDs, validates each course exists, checks permissions,
     * sets visible=1, and calls update_course() for each. Collects success/error
     * status for each course ID.
     *
     * @param array $courseids Array of course IDs to show
     * @return array Results array with status for each course
     */
    private function processBulkShow($courseids) {
        global $DB;
        
        $results = [];
        
        foreach ($courseids as $courseid) {
            // Validate course ID is numeric
            if (!is_numeric($courseid)) {
                $results[] = [
                    'courseid' => $courseid,
                    'status' => 'error',
                    'message' => 'Invalid course ID: must be numeric'
                ];
                continue;
            }
            
            $courseid = (int)$courseid;
            
            try {
                // Retrieve course record from database
                $course = $DB->get_record('course', ['id' => $courseid]);
                
                if (!$course) {
                    $results[] = [
                        'courseid' => $courseid,
                        'status' => 'error',
                        'message' => 'Course not found'
                    ];
                    continue;
                }
                
                // Prevent operations on site course (front page)
                if ($course->id == SITEID) {
                    $results[] = [
                        'courseid' => $courseid,
                        'status' => 'error',
                        'message' => 'Cannot modify site course'
                    ];
                    continue;
                }
                
                // Get course context for permission checks
                $context = context_course::instance($courseid);
                
                // Set course visibility to visible
                $course->visible = 1;
                
                // Call existing Moodle function to update course
                // This handles all validation, triggers, events, and caching
                update_course($course);
                
                $results[] = [
                    'courseid' => $courseid,
                    'status' => 'success',
                    'message' => 'Course shown successfully'
                ];
                
            } catch (moodle_exception $e) {
                // Catch Moodle exceptions from update_course()
                $results[] = [
                    'courseid' => $courseid,
                    'status' => 'error',
                    'message' => $e->getMessage()
                ];
                
            } catch (Exception $e) {
                // Catch unexpected exceptions
                $results[] = [
                    'courseid' => $courseid,
                    'status' => 'error',
                    'message' => 'Unexpected error: ' . $e->getMessage()
                ];
            }
        }
        
        return $results;
    }
    
    /**
     * Process bulk delete operation for multiple courses.
     *
     * Iterates through course IDs, validates each course exists, validates deletion
     * is allowed via can_delete_course(), and calls delete_course() for each.
     * Collects success/error status for each course ID. This operation is
     * irreversible and removes all course content.
     *
     * @param array $courseids Array of course IDs to delete
     * @return array Results array with status for each course
     */
    private function processBulkDelete($courseids) {
        global $DB;
        
        $results = [];
        
        foreach ($courseids as $courseid) {
            // Validate course ID is numeric
            if (!is_numeric($courseid)) {
                $results[] = [
                    'courseid' => $courseid,
                    'status' => 'error',
                    'message' => 'Invalid course ID: must be numeric'
                ];
                continue;
            }
            
            $courseid = (int)$courseid;
            
            try {
                // Retrieve course record from database
                $course = $DB->get_record('course', ['id' => $courseid]);
                
                if (!$course) {
                    $results[] = [
                        'courseid' => $courseid,
                        'status' => 'error',
                        'message' => 'Course not found'
                    ];
                    continue;
                }
                
                // Prevent deletion of site course (front page)
                if ($course->id == SITEID) {
                    $results[] = [
                        'courseid' => $courseid,
                        'status' => 'error',
                        'message' => 'Cannot delete site course'
                    ];
                    continue;
                }
                
                // Validate course can be deleted using existing Moodle function
                // This checks for dependencies, enrollments, and other constraints
                if (!can_delete_course($courseid)) {
                    $results[] = [
                        'courseid' => $courseid,
                        'status' => 'error',
                        'message' => 'Course cannot be deleted (has dependencies or constraints)'
                    ];
                    continue;
                }
                
                // Call existing Moodle function to delete course
                // Second parameter false means don't show feedback messages
                // This handles all cleanup: modules, files, grades, enrollments, etc.
                delete_course($course, false);
                
                $results[] = [
                    'courseid' => $courseid,
                    'status' => 'success',
                    'message' => 'Course deleted successfully'
                ];
                
            } catch (moodle_exception $e) {
                // Catch Moodle exceptions from delete_course()
                $results[] = [
                    'courseid' => $courseid,
                    'status' => 'error',
                    'message' => $e->getMessage()
                ];
                
            } catch (Exception $e) {
                // Catch unexpected exceptions
                $results[] = [
                    'courseid' => $courseid,
                    'status' => 'error',
                    'message' => 'Unexpected error: ' . $e->getMessage()
                ];
            }
        }
        
        return $results;
    }
    
    /**
     * GET method not supported for bulk operations.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for bulk operations', [
            'allowedMethods' => ['POST'],
            'endpoint' => '/api/v1/admin/courses/bulk'
        ]);
    }
    
    /**
     * PUT method not supported for bulk operations.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for bulk operations', [
            'allowedMethods' => ['POST'],
            'endpoint' => '/api/v1/admin/courses/bulk'
        ]);
    }
    
    /**
     * DELETE method not supported for bulk operations.
     *
     * Use POST with action='delete' instead.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported. Use POST with action="delete"', [
            'allowedMethods' => ['POST'],
            'endpoint' => '/api/v1/admin/courses/bulk',
            'hint' => 'Send POST request with {"action": "delete", "courseids": [...]}'
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new BulkCourseOperationsEndpoint();
$endpoint->execute();
