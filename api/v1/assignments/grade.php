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
 * REST API endpoint for grading assignment submissions.
 *
 * POST /api/v1/assignments/{id}/grade
 *
 * Processes grade updates for assignment submissions by wrapping existing
 * assign class grading methods from public/mod/assign/locallib.php. Handles:
 * - Numeric grades and scale-based grades with validation
 * - Grade comments and feedback
 * - Outcomes processing
 * - Workflow state management (marking workflow)
 * - Allocated marker assignment
 * - Team submission grading with applytoall flag
 * - New attempt creation with addattempt flag
 * - Gradebook updates via existing update_grade() method
 * - Grade notifications via existing notify_grade_modified() method
 *
 * This endpoint enforces mod/assign:grade capability and validates all grade
 * data before calling existing Moodle business logic. It follows the thin
 * wrapper pattern by delegating all grading operations to the assign class
 * save_grade() method, which handles grade validation, submission management,
 * team grading, workflow states, gradebook updates, and notifications.
 *
 * Request body (JSON):
 * {
 *   "userid": 123,                  // Student user ID (required)
 *   "grade": 85.5,                  // Numeric grade or scale item (required)
 *   "attemptnumber": 0,             // Submission attempt to grade (optional, default: -1 for latest)
 *   "addattempt": false,            // Allow another attempt after grading (optional)
 *   "workflowstate": "released",    // Marking workflow state (optional)
 *   "allocatedmarker": 456,         // Assigned grader user ID (optional)
 *   "applytoall": true,             // Apply grade to all team members (optional, for team submissions)
 *   "sendstudentnotifications": true // Send grade notification (optional, default: true)
 * }
 *
 * Response (success):
 * {
 *   "success": true,
 *   "data": {
 *     "grade": {
 *       "id": 789,
 *       "assignment": 42,
 *       "userid": 123,
 *       "grader": 456,
 *       "grade": 85.5,
 *       "timemodified": 1698765432,
 *       "attemptnumber": 0,
 *       "addattempt": false,
 *       "workflowstate": "released",
 *       "allocatedmarker": 456
 *     }
 *   }
 * }
 *
 * Error responses:
 * - 400 Bad Request: Invalid grade value, malformed JSON, validation errors
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: User lacks mod/assign:grade capability
 * - 404 Not Found: Assignment or submission not found
 * - 500 Internal Server Error: Unexpected server error
 *
 * @package    api
 * @subpackage v1
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/moodlelib.php');
require_once($CFG->libdir . '/accesslib.php');
require_once($CFG->libdir . '/gradelib.php');

// Load assignment module library with assign class and grading functions
require_once($CFG->dirroot . '/mod/assign/locallib.php');

// Load API base class for authentication and request handling
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * Assignment grading endpoint class.
 *
 * Handles POST requests to grade assignment submissions by validating
 * authentication, checking permissions, extracting grade data, and
 * delegating to existing assign->save_grade() business logic.
 */
class AssignmentGradeEndpoint extends ApiBase {
    
    /**
     * Handle POST request to grade an assignment submission.
     *
     * Processes the grading request by:
     * 1. Extracting assignment ID from URL path
     * 2. Loading course module and validating it's an assignment
     * 3. Getting module context for permission checking
     * 4. Validating JWT authentication (automatic via ApiBase)
     * 5. Checking mod/assign:grade capability
     * 6. Parsing JSON request body with grade data
     * 7. Validating grade value against assignment settings
     * 8. Getting or creating submission for the student
     * 9. Creating grade data object with all required fields
     * 10. Calling assign->save_grade() to process the grade
     * 11. Handling team submissions with applytoall flag
     * 12. Managing workflow states and marker allocation
     * 13. Triggering gradebook updates and notifications
     * 14. Returning formatted grade response
     *
     * @return void Outputs JSON response directly via success() or error()
     * @throws ValidationException If grade data is invalid
     * @throws NotFoundException If assignment or submission not found
     * @throws ForbiddenException If user lacks grading permission
     * @throws ServerException If unexpected error occurs
     */
    protected function handle_post() {
        global $DB, $USER;
        
        // Extract assignment ID from URL path
        // URL format: /api/v1/assignments/{id}/grade
        $urlparts = explode('/', trim($this->requestUri, '/'));
        $assignmentid = null;
        
        // Find the assignment ID in URL (after "assignments")
        $assignmentsIndex = array_search('assignments', $urlparts);
        if ($assignmentsIndex !== false && isset($urlparts[$assignmentsIndex + 1])) {
            $assignmentid = clean_param($urlparts[$assignmentsIndex + 1], PARAM_INT);
        }
        
        if (!$assignmentid) {
            throw new ValidationException('Assignment ID is required in URL', [
                'url' => $this->requestUri,
                'format' => '/api/v1/assignments/{id}/grade'
            ]);
        }
        
        // Load course module from assignment ID
        $cm = get_coursemodule_from_instance('assign', $assignmentid, 0, false, MUST_EXIST);
        if (!$cm) {
            throw new NotFoundException('Assignment not found', [
                'assignmentId' => $assignmentid
            ]);
        }
        
        // Verify this is actually an assignment module
        if ($cm->modname !== 'assign') {
            throw new ValidationException('Invalid module type', [
                'expected' => 'assign',
                'actual' => $cm->modname,
                'moduleId' => $cm->id
            ]);
        }
        
        // Get module context for permission checking
        $context = context_module::instance($cm->id);
        
        // Check grading capability (throws ForbiddenException if user lacks permission)
        // This uses existing Moodle capability system via ApiBase->checkCapability()
        $this->checkCapability('mod/assign:grade', $context);
        
        // Get authenticated user (grader) from JWT token
        $grader = $this->getUser();
        
        // Parse JSON request body with grade data
        $data = $this->getJsonBody();
        
        // Validate required fields in request body
        if (!isset($data['userid'])) {
            throw new ValidationException('Student userid is required', [
                'required' => ['userid'],
                'received' => array_keys($data)
            ]);
        }
        
        if (!isset($data['grade'])) {
            throw new ValidationException('Grade value is required', [
                'required' => ['userid', 'grade'],
                'received' => array_keys($data)
            ]);
        }
        
        // Extract and validate userid
        $userid = clean_param($data['userid'], PARAM_INT);
        if ($userid <= 0) {
            throw new ValidationException('Invalid userid', [
                'userid' => $data['userid'],
                'reason' => 'userid must be a positive integer'
            ]);
        }
        
        // Verify student user exists
        $student = $DB->get_record('user', ['id' => $userid], '*', IGNORE_MISSING);
        if (!$student) {
            throw new NotFoundException('Student user not found', [
                'userid' => $userid
            ]);
        }
        
        // Instantiate assign class to access grading methods
        // Constructor: assign($context, $coursemodule, $course)
        // Pass null for coursemodule and course - assign class will load them from context
        $assign = new assign($context, null, null);
        
        // Get assignment instance for grade validation
        $instance = $assign->get_instance();
        
        // Extract grade value and validate based on assignment grading type
        $gradevalue = $data['grade'];
        
        // Validate grade value range
        if (is_numeric($gradevalue)) {
            // For numeric grades, validate against assignment's maximum grade
            $gradevalue = floatval($gradevalue);
            
            if ($gradevalue < 0) {
                throw new ValidationException('Grade cannot be negative', [
                    'grade' => $gradevalue,
                    'minimum' => 0,
                    'maximum' => $instance->grade
                ]);
            }
            
            if ($gradevalue > $instance->grade) {
                throw new ValidationException('Grade exceeds maximum', [
                    'grade' => $gradevalue,
                    'maximum' => $instance->grade,
                    'reason' => 'Grade must be between 0 and maximum grade'
                ]);
            }
        } else if ($instance->grade < 0) {
            // Scale-based grading (grade is negative scale ID)
            // Validate scale item value
            $scaleid = abs($instance->grade);
            $scale = $DB->get_record('scale', ['id' => $scaleid], '*', MUST_EXIST);
            
            $scaleitems = explode(',', $scale->scale);
            $gradevalue = clean_param($gradevalue, PARAM_INT);
            
            if ($gradevalue < 1 || $gradevalue > count($scaleitems)) {
                throw new ValidationException('Invalid scale item', [
                    'grade' => $gradevalue,
                    'scaleId' => $scaleid,
                    'validRange' => '1 to ' . count($scaleitems),
                    'scaleItems' => $scaleitems
                ]);
            }
        } else {
            // Invalid grade format
            throw new ValidationException('Invalid grade format', [
                'grade' => $gradevalue,
                'expected' => 'numeric value or scale item'
            ]);
        }
        
        // Extract optional parameters with defaults
        $attemptnumber = isset($data['attemptnumber']) ? clean_param($data['attemptnumber'], PARAM_INT) : -1;
        $addattempt = isset($data['addattempt']) ? (bool)$data['addattempt'] : false;
        $applytoall = isset($data['applytoall']) ? (bool)$data['applytoall'] : false;
        $sendnotifications = isset($data['sendstudentnotifications']) ? (bool)$data['sendstudentnotifications'] : true;
        
        // Extract workflow state if provided (for marking workflow)
        $workflowstate = null;
        if (isset($data['workflowstate'])) {
            $workflowstate = clean_param($data['workflowstate'], PARAM_ALPHA);
            
            // Validate workflow state against allowed values
            $validworkflowstates = [
                ASSIGN_MARKING_WORKFLOW_STATE_NOTMARKED,
                ASSIGN_MARKING_WORKFLOW_STATE_INMARKING,
                ASSIGN_MARKING_WORKFLOW_STATE_READYFORREVIEW,
                ASSIGN_MARKING_WORKFLOW_STATE_INREVIEW,
                ASSIGN_MARKING_WORKFLOW_STATE_READYFORRELEASE,
                ASSIGN_MARKING_WORKFLOW_STATE_RELEASED
            ];
            
            if (!in_array($workflowstate, $validworkflowstates)) {
                throw new ValidationException('Invalid workflow state', [
                    'workflowstate' => $workflowstate,
                    'validStates' => $validworkflowstates
                ]);
            }
        }
        
        // Extract allocated marker if provided
        $allocatedmarker = null;
        if (isset($data['allocatedmarker'])) {
            $allocatedmarker = clean_param($data['allocatedmarker'], PARAM_INT);
            
            // Verify marker user exists
            if ($allocatedmarker > 0) {
                $marker = $DB->get_record('user', ['id' => $allocatedmarker], 'id', IGNORE_MISSING);
                if (!$marker) {
                    throw new ValidationException('Allocated marker user not found', [
                        'allocatedmarker' => $allocatedmarker
                    ]);
                }
            }
        }
        
        // Get or create submission for this attempt
        // This ensures a submission record exists before grading
        if ($instance->teamsubmission) {
            // For team submissions, get group submission
            $submission = $assign->get_group_submission($userid, 0, false, $attemptnumber);
        } else {
            // For individual submissions, get user submission
            // Second parameter: create if not exists (false = don't create yet, save_grade will handle)
            $submission = $assign->get_user_submission($userid, false, $attemptnumber);
            
            // If submission doesn't exist for this attempt, we'll let save_grade handle creation
            // This is the expected behavior for new grades
        }
        
        // Create grade data object with all required fields
        // This object structure matches what assign->save_grade() expects
        $gradedata = new stdClass();
        $gradedata->userid = $userid;
        $gradedata->grade = $gradevalue;
        $gradedata->attemptnumber = $attemptnumber;
        $gradedata->addattempt = $addattempt;
        $gradedata->applytoall = $applytoall;
        $gradedata->sendstudentnotifications = $sendnotifications;
        
        // Add workflow state if provided
        if ($workflowstate !== null) {
            $gradedata->workflowstate = $workflowstate;
        }
        
        // Add allocated marker if provided
        if ($allocatedmarker !== null) {
            $gradedata->allocatedmarker = $allocatedmarker;
        }
        
        // Set the current user as grader in global scope
        // The assign class uses global $USER to determine the grader
        $olduser = $USER;
        $USER = $grader;
        
        try {
            // Call existing assign->save_grade() method to process the grade
            // This method handles all grading business logic:
            // - Validates capability (will recheck mod/assign:grade)
            // - Handles team submissions with applytoall flag
            // - Calls apply_grade_to_user() for each affected user
            // - Processes outcomes with process_outcomes()
            // - Updates workflow states and allocated markers
            // - Triggers gradebook updates via update_grade()
            // - Sends notifications via notify_grade_modified()
            // - Handles new attempt creation if addattempt is true
            $success = $assign->save_grade($userid, $gradedata);
            
            if (!$success) {
                throw new ServerException('Failed to save grade', [
                    'userid' => $userid,
                    'assignmentId' => $assignmentid
                ]);
            }
            
            // Get the updated grade record from database
            // Use -1 for attemptnumber to get latest grade
            $updatedgrade = $assign->get_user_grade($userid, false);
            
            // If no grade was found (shouldn't happen after save_grade), throw error
            if (!$updatedgrade) {
                throw new ServerException('Grade was saved but could not be retrieved', [
                    'userid' => $userid,
                    'assignmentId' => $assignmentid
                ]);
            }
            
            // Get user flags for workflow state and allocated marker
            $flags = $assign->get_user_flags($userid, false);
            
            // Format response data with complete grade information
            $responsedata = [
                'grade' => [
                    'id' => $updatedgrade->id,
                    'assignment' => $updatedgrade->assignment,
                    'userid' => $updatedgrade->userid,
                    'grader' => $updatedgrade->grader,
                    'grade' => $updatedgrade->grade,
                    'timemodified' => $updatedgrade->timemodified,
                    'timecreated' => $updatedgrade->timecreated ?? null,
                    'attemptnumber' => $updatedgrade->attemptnumber
                ]
            ];
            
            // Add workflow state if available
            if ($flags && isset($flags->workflowstate)) {
                $responsedata['grade']['workflowstate'] = $flags->workflowstate;
            }
            
            // Add allocated marker if available
            if ($flags && isset($flags->allocatedmarker)) {
                $responsedata['grade']['allocatedmarker'] = $flags->allocatedmarker;
            }
            
            // Add addattempt flag if a new attempt was created
            if ($addattempt) {
                $responsedata['grade']['addattempt'] = true;
            }
            
            // Restore global USER
            $USER = $olduser;
            
            // Return success response with grade data
            $this->success($responsedata, 200);
            
        } catch (moodle_exception $e) {
            // Restore global USER before handling exception
            $USER = $olduser;
            
            // Handle Moodle exceptions from assign->save_grade()
            // These could be permission errors, validation errors, etc.
            throw new ServerException('Grading failed: ' . $e->getMessage(), [
                'errorcode' => $e->errorcode,
                'module' => $e->module ?? 'mod_assign',
                'userid' => $userid,
                'assignmentId' => $assignmentid,
                'debuginfo' => $e->debuginfo ?? null
            ]);
            
        } catch (Exception $e) {
            // Restore global USER before handling exception
            $USER = $olduser;
            
            // Re-throw other exceptions
            throw $e;
        }
    }
    
    /**
     * Handle GET request - not supported for grading endpoint.
     *
     * Grading requires POST method for data submission. GET is not allowed.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for grading', [
            'supportedMethods' => ['POST'],
            'reason' => 'Use POST to submit grade data'
        ]);
    }
    
    /**
     * Handle PUT request - not supported for grading endpoint.
     *
     * Grading uses POST method for consistency with existing Moodle patterns.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for grading', [
            'supportedMethods' => ['POST'],
            'reason' => 'Use POST to submit grade data'
        ]);
    }
    
    /**
     * Handle DELETE request - not supported for grading endpoint.
     *
     * Grades cannot be deleted via API, only updated.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for grading', [
            'supportedMethods' => ['POST'],
            'reason' => 'Grades cannot be deleted, only updated'
        ]);
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new AssignmentGradeEndpoint();
    $endpoint->execute();
}
