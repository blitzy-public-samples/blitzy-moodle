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
 * REST API endpoint for retrieving assignment details.
 *
 * GET /api/v1/assignments/{id}
 *
 * This endpoint provides comprehensive assignment information including metadata,
 * settings, submission requirements, grading criteria, and plugin configurations.
 * It wraps existing Moodle assign class methods without duplicating business logic.
 *
 * Request:
 * - Method: GET
 * - URL: /api/v1/assignments/{id}
 * - Headers: Authorization: Bearer <JWT token>
 * - Parameters: {id} - Assignment course module ID (cmid)
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "coursemodule": 456,
 *     "course": 789,
 *     "name": "Assignment 1",
 *     "intro": "Assignment description...",
 *     "introformat": 1,
 *     "duedate": 1609459200,
 *     "cutoffdate": 1609545600,
 *     "allowsubmissionsfromdate": 1609372800,
 *     "grade": 100,
 *     "timemodified": 1609372800,
 *     "settings": {
 *       "requiresubmissionstatement": 1,
 *       "teamsubmission": 0,
 *       "preventsubmissionnotingroup": 0,
 *       "submissiondrafts": 0,
 *       "sendnotifications": 1,
 *       "sendlatenotifications": 1,
 *       "sendstudentnotifications": 1,
 *       "blindmarking": 0,
 *       "hidegrader": 0,
 *       "revealidentities": null,
 *       "attemptreopenmethod": "none",
 *       "maxattempts": -1,
 *       "markingworkflow": 0,
 *       "markingallocation": 0,
 *       "completionsubmit": 0
 *     },
 *     "plugins": {
 *       "submission": [
 *         {
 *           "type": "file",
 *           "name": "File submissions",
 *           "enabled": true
 *         }
 *       ],
 *       "feedback": [
 *         {
 *           "type": "comments",
 *           "name": "Feedback comments",
 *           "enabled": true
 *         }
 *       ]
 *     },
 *     "gradeitem": {
 *       "id": 101,
 *       "grademax": 100,
 *       "grademin": 0,
 *       "gradepass": 50
 *     }
 *   }
 * }
 *
 * Error Responses:
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: User lacks mod/assign:view capability
 * - 404 Not Found: Assignment does not exist
 * - 500 Internal Server Error: Unexpected error
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and dependencies
// Only require config if not already loaded (for test compatibility)
if (!defined('MOODLE_INTERNAL')) {
    require_once(__DIR__ . '/../../../config.php');
}
require_once($CFG->dirroot . '/mod/assign/locallib.php');
require_once($CFG->dirroot . '/lib/gradelib.php');

// Load API infrastructure
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Assignment detail retrieval endpoint.
 *
 * Extends ApiBase to provide GET endpoint for assignment details. Validates
 * JWT authentication, enforces mod/assign:view capability, and returns
 * comprehensive assignment information by calling existing assign class methods.
 *
 * This is a thin wrapper that delegates all business logic to existing Moodle
 * core functions. No grade calculations, permission logic, or data processing
 * is duplicated - all operations use existing assign class methods.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class AssignmentShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve assignment details.
     *
     * Extracts assignment ID from URL path, validates permissions, and returns
     * comprehensive assignment data including settings, plugins, and grade item.
     *
     * Process:
     * 1. Extract assignment coursemodule ID from URL path (/api/v1/assignments/{id})
     * 2. Load course module record and verify it's an assignment module
     * 3. Get module context and check mod/assign:view capability
     * 4. Instantiate assign class using existing pattern from externallib.php
     * 5. Call get_instance() to retrieve assignment record with all properties
     * 6. Call get_submission_plugins() and get_feedback_plugins() for plugin info
     * 7. Call get_grade_item() to include grading configuration
     * 8. Format response with assignment details, settings, plugins, and grade item
     * 9. Return success response with formatted data
     *
     * @return void Outputs JSON response via success() method
     * @throws NotFoundException If assignment course module does not exist
     * @throws ForbiddenException If user lacks mod/assign:view capability
     * @throws ServerException If unexpected error occurs
     */
    protected function handle_get() {
        global $DB;
        
        try {
            // Extract assignment ID from URL path
            // URL pattern: /api/v1/assignments/{id}
            // Example: /api/v1/assignments/123 -> ID = 123
            $urlPath = parse_url($this->requestUri, PHP_URL_PATH);
            $pathParts = explode('/', trim($urlPath, '/'));
            
            // Find 'assignments' in path and get next element as ID
            $assignmentIndex = array_search('assignments', $pathParts);
            if ($assignmentIndex === false || !isset($pathParts[$assignmentIndex + 1])) {
                throw new NotFoundException('Assignment ID not provided in URL', [
                    'url' => $this->requestUri,
                    'expected_format' => '/api/v1/assignments/{id}'
                ]);
            }
            
            $cmid = $pathParts[$assignmentIndex + 1];
            
            // Validate ID is integer
            if (!is_numeric($cmid) || intval($cmid) != $cmid || intval($cmid) <= 0) {
                throw new ValidationException('Assignment ID must be a positive integer', [
                    'provided' => $cmid,
                    'type' => gettype($cmid)
                ]);
            }
            
            $cmid = intval($cmid);
            
            // Load course module record
            // Using get_coursemodule_from_id() to ensure module exists and is assignment
            $courseModule = get_coursemodule_from_id('assign', $cmid, 0, false, MUST_EXIST);
            
            if (!$courseModule) {
                throw new NotFoundException('Assignment not found', [
                    'cmid' => $cmid,
                    'reason' => 'Course module does not exist or is not an assignment'
                ]);
            }
            
            // Get context for capability checking
            $context = context_module::instance($cmid);
            
            // Check if user has permission to view this assignment
            // This wraps require_capability() and throws ForbiddenException on failure
            $this->checkCapability('mod/assign:view', $context);
            
            // Instantiate assign class using pattern from externallib.php line 94
            // Constructor signature: __construct($cm, $course, $context)
            // Passing null for $cm and $course allows assign class to load them internally
            $assign = new assign($context, null, null);
            
            // Get assignment instance with all properties
            // Calls get_default_instance() internally which loads from mdl_assign table
            // Returns stdClass with: name, intro, duedate, cutoffdate, allowsubmissionsfromdate,
            // grade, timemodified, requiresubmissionstatement, teamsubmission, etc.
            $instance = $assign->get_instance();
            
            // Get submission plugins configuration
            // Returns array of submission plugin objects (file, onlinetext, comments, etc.)
            // Each plugin has: type, name, enabled, visible properties
            $submissionPlugins = $assign->get_submission_plugins();
            
            // Get feedback plugins configuration  
            // Returns array of feedback plugin objects (comments, file, etc.)
            // Each plugin has: type, name, enabled, visible properties
            $feedbackPlugins = $assign->get_feedback_plugins();
            
            // Get grade item for grading configuration
            // Returns grade_item object with: id, grademax, grademin, gradepass, etc.
            $gradeItem = $assign->get_grade_item();
            
            // Format response data structure
            $data = [
                // Core assignment identifiers
                'id' => $instance->id,
                'coursemodule' => $courseModule->id,
                'course' => $instance->course,
                
                // Assignment metadata
                'name' => $instance->name,
                'intro' => $instance->intro,
                'introformat' => $instance->introformat,
                
                // Dates (Unix timestamps)
                'duedate' => $instance->duedate,
                'cutoffdate' => $instance->cutoffdate,
                'allowsubmissionsfromdate' => $instance->allowsubmissionsfromdate,
                
                // Grading
                'grade' => $instance->grade,
                'timemodified' => $instance->timemodified,
                
                // Assignment settings grouped for clarity
                'settings' => [
                    'requiresubmissionstatement' => $instance->requiresubmissionstatement,
                    'teamsubmission' => $instance->teamsubmission,
                    'preventsubmissionnotingroup' => $instance->preventsubmissionnotingroup,
                    'submissiondrafts' => $instance->submissiondrafts,
                    'sendnotifications' => $instance->sendnotifications,
                    'sendlatenotifications' => $instance->sendlatenotifications,
                    'sendstudentnotifications' => $instance->sendstudentnotifications,
                    'blindmarking' => $instance->blindmarking,
                    'hidegrader' => $instance->hidegrader,
                    'revealidentities' => $instance->revealidentities ?? null,
                    'attemptreopenmethod' => $instance->attemptreopenmethod,
                    'maxattempts' => $instance->maxattempts,
                    'markingworkflow' => $instance->markingworkflow,
                    'markingallocation' => $instance->markingallocation,
                    'completionsubmit' => $instance->completionsubmit ?? 0,
                ],
                
                // Plugin configurations
                'plugins' => [
                    'submission' => $this->formatPlugins($submissionPlugins),
                    'feedback' => $this->formatPlugins($feedbackPlugins),
                ],
                
                // Grade item configuration
                'gradeitem' => $gradeItem ? [
                    'id' => $gradeItem->id,
                    'grademax' => $gradeItem->grademax,
                    'grademin' => $gradeItem->grademin,
                    'gradepass' => $gradeItem->gradepass,
                    'gradetype' => $gradeItem->gradetype,
                    'itemname' => $gradeItem->itemname,
                ] : null,
            ];
            
            // Return success response with formatted data
            // Uses ApiResponse::success() with standard envelope format
            $this->success($data);
            
        } catch (NotFoundException $e) {
            // Re-throw NotFoundException as-is (already formatted)
            throw $e;
            
        } catch (ForbiddenException $e) {
            // Re-throw ForbiddenException as-is (already formatted)
            throw $e;
            
        } catch (ValidationException $e) {
            // Re-throw ValidationException as-is (already formatted)
            throw $e;
            
        } catch (moodle_exception $e) {
            // Handle Moodle exceptions (e.g., from get_coursemodule_from_id)
            // Convert to appropriate API exception based on error code
            if (strpos($e->getMessage(), 'not found') !== false || $e->errorcode === 'invalidcoursemodule') {
                throw new NotFoundException('Assignment not found', [
                    'cmid' => $cmid ?? null,
                    'moodleError' => $e->getMessage(),
                    'errorcode' => $e->errorcode
                ]);
            } else if (strpos($e->getMessage(), 'permission') !== false || $e->errorcode === 'nopermission') {
                throw new ForbiddenException('Permission denied', [
                    'moodleError' => $e->getMessage(),
                    'errorcode' => $e->errorcode
                ]);
            } else {
                // Generic Moodle error - wrap as server exception
                throw new ServerException('Failed to retrieve assignment', [
                    'moodleError' => $e->getMessage(),
                    'errorcode' => $e->errorcode,
                    'debuginfo' => $e->debuginfo ?? null
                ]);
            }
            
        } catch (Exception $e) {
            // Handle unexpected exceptions
            throw new ServerException('Internal server error while retrieving assignment', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
        }
    }
    
    /**
     * Format plugin array for API response.
     *
     * Extracts relevant plugin information (type, name, enabled status) from
     * plugin objects returned by assign class. Filters to only include enabled
     * and visible plugins for client consumption.
     *
     * @param array $plugins Array of plugin objects from get_submission_plugins() or get_feedback_plugins()
     * @return array Array of formatted plugin info arrays
     */
    private function formatPlugins($plugins) {
        $formatted = [];
        
        foreach ($plugins as $plugin) {
            // Only include plugins that are enabled and visible
            if ($plugin->is_enabled() && $plugin->is_visible()) {
                $formatted[] = [
                    'type' => $plugin->get_type(),
                    'name' => $plugin->get_name(),
                    'enabled' => true,
                ];
            }
        }
        
        return $formatted;
    }
    
    /**
     * Handle POST request (not supported).
     *
     * Assignment detail endpoint is read-only. POST requests are not allowed.
     * Throws MethodNotAllowedException with 405 status.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws - POST not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for assignment detail retrieval', [
            'supportedMethods' => ['GET'],
            'endpoint' => '/api/v1/assignments/{id}'
        ]);
    }
    
    /**
     * Handle PUT request (not supported).
     *
     * Assignment detail endpoint is read-only. PUT requests for updates should
     * use separate update endpoint. Throws MethodNotAllowedException with 405 status.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws - PUT not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for assignment detail retrieval', [
            'supportedMethods' => ['GET'],
            'endpoint' => '/api/v1/assignments/{id}',
            'hint' => 'Use PUT /api/v1/assignments/{id}/update for modifications'
        ]);
    }
    
    /**
     * Handle DELETE request (not supported).
     *
     * Assignment detail endpoint is read-only. DELETE requests should use
     * separate delete endpoint. Throws MethodNotAllowedException with 405 status.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws - DELETE not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for assignment detail retrieval', [
            'supportedMethods' => ['GET'],
            'endpoint' => '/api/v1/assignments/{id}',
            'hint' => 'Use DELETE /api/v1/assignments/{id} for deletion'
        ]);
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new AssignmentShowEndpoint();
    $endpoint->execute();
}
