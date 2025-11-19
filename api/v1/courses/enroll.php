<?php
/**
 * Course Enrollment API Endpoint
 *
 * POST /api/v1/courses/{id}/enroll - Enroll user in a course
 *
 * This endpoint wraps existing Moodle enrollment functionality without
 * duplicating any business logic. All enrollment operations delegate to
 * the core enrol_try_internal_enrol() function.
 *
 * @package    api
 * @subpackage v1
 * @copyright  2024 Moodle React Migration
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include required Moodle core files
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/moodlelib.php');
require_once($CFG->dirroot . '/lib/enrollib.php');
require_once($CFG->dirroot . '/lib/accesslib.php');

// Include API framework files
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Course Enrollment Endpoint Handler
 *
 * Handles POST requests to enroll a user into a course.
 * Delegates all business logic to existing Moodle core functions:
 * - get_course() for course validation
 * - context_course::instance() for context creation
 * - require_capability() for permission checks (wrapped in checkCapability())
 * - enrol_try_internal_enrol() for enrollment execution
 *
 * URL Path Parameters:
 * - id: Course ID (required, integer from URL path /api/v1/courses/{id}/enroll)
 *
 * JSON POST Body Parameters:
 * - userid: User ID to enroll (optional integer, defaults to authenticated user)
 * - roleid: Role ID to assign (optional integer, defaults to student role)
 * - timestart: Enrollment start time (optional integer, Unix timestamp)
 * - timeend: Enrollment end time (optional integer, Unix timestamp)
 *
 * Success Response (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "enrollment": {
 *       "courseid": 5,
 *       "userid": 123,
 *       "roleid": 5,
 *       "timeenrolled": 1640000000,
 *       "timestart": 0,
 *       "timeend": 0
 *     }
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid parameters, validation failures
 * - 401 Unauthorized: No JWT token or invalid token
 * - 403 Forbidden: Insufficient permissions
 * - 404 Not Found: Course or user does not exist
 * - 409 Conflict: User already enrolled
 * - 500 Internal Server Error: Unexpected server errors
 */
class CourseEnrollEndpoint extends ApiBase {
    
    /**
     * Handle POST requests to enroll a user in a course.
     *
     * Implementation flow:
     * 1. Extract authenticated user from JWT token via getUser()
     * 2. Extract course ID from URL path parameter via getParam()
     * 3. Parse JSON request body via getJsonBody() for enrollment parameters
     * 4. Validate course exists using get_course()
     * 5. Get course context and check enrol/manual:enrol capability
     * 6. Validate target user exists and determine enrollment permissions
     * 7. Validate role and time parameters
     * 8. Call enrol_try_internal_enrol() to execute enrollment
     * 9. Return standardized JSON success response
     *
     * @return void Outputs JSON response and exits
     * @throws ValidationException For invalid input parameters
     * @throws NotFoundException For non-existent course or user
     * @throws ForbiddenException For permission failures
     */
    protected function handle_post() {
        global $CFG, $DB;

        // Step 1: Get authenticated user from JWT token
        $authuser = $this->getUser();
        if (!$authuser || !isset($authuser->id)) {
            throw new ValidationException('Authentication required - no valid user session');
        }

        // Step 2: Extract and validate course ID from URL path parameter
        $courseid = $this->getParam('id', PARAM_INT, true);
        
        if ($courseid <= 0) {
            throw new ValidationException('Invalid course ID - must be a positive integer');
        }

        // Step 3: Parse JSON request body to get enrollment parameters
        $requestbody = $this->getJsonBody();
        
        // Extract userid (optional, defaults to authenticated user)
        $userid = isset($requestbody['userid']) ? (int)$requestbody['userid'] : (int)$authuser->id;
        
        // Extract roleid (optional, defaults to student role)
        $roleid = isset($requestbody['roleid']) ? (int)$requestbody['roleid'] : null;
        
        // Extract timestart (optional, defaults to 0 for immediate start)
        $timestart = isset($requestbody['timestart']) ? (int)$requestbody['timestart'] : 0;
        
        // Extract timeend (optional, defaults to 0 for no end date)
        $timeend = isset($requestbody['timeend']) ? (int)$requestbody['timeend'] : 0;

        // Step 4: Validate that the course exists using core Moodle function
        try {
            $course = get_course($courseid);
        } catch (dml_missing_record_exception $e) {
            throw new NotFoundException("Course with ID {$courseid} does not exist");
        } catch (Exception $e) {
            throw new NotFoundException("Course with ID {$courseid} not found: " . $e->getMessage());
        }

        // Step 5: Get course context for permission checks
        $coursecontext = context_course::instance($courseid);

        // Step 6: Determine enrollment permissions and validate target user
        $isselfenroll = ($userid == $authuser->id);
        
        if (!$isselfenroll) {
            // Enrolling another user - requires enrol/manual:enrol capability at course context
            // This uses the checkCapability() method from ApiBase which wraps require_capability()
            $this->checkCapability('enrol/manual:enrol', $coursecontext);
        } else {
            // Self-enrollment - check if self-enrollment is enabled for this course
            $selfenrolenabled = false;
            $enrolinstances = enrol_get_instances($courseid, true);
            
            foreach ($enrolinstances as $instance) {
                if ($instance->enrol === 'self' && $instance->status == ENROL_INSTANCE_ENABLED) {
                    $selfenrolenabled = true;
                    break;
                }
            }
            
            if (!$selfenrolenabled) {
                // Self-enrollment not available, check if user has manual enrollment permission
                try {
                    $this->checkCapability('enrol/manual:enrol', $coursecontext);
                } catch (ForbiddenException $e) {
                    throw new ForbiddenException(
                        'Self-enrollment is not enabled for this course and you do not have permission to enroll users'
                    );
                }
            }
        }

        // Validate that target user exists and is not deleted or suspended
        $targetuser = $DB->get_record('user', ['id' => $userid], 'id, deleted, suspended', MUST_EXIST);
        
        if (!$targetuser) {
            throw new NotFoundException("User with ID {$userid} does not exist");
        }
        
        if ($targetuser->deleted) {
            throw new ValidationException("User with ID {$userid} has been deleted and cannot be enrolled");
        }
        
        if ($targetuser->suspended) {
            throw new ValidationException("User with ID {$userid} is suspended and cannot be enrolled");
        }

        // Check if user is already enrolled in this course
        if (is_enrolled($coursecontext, $userid, '', true)) {
            throw new ValidationException(
                "User with ID {$userid} is already enrolled in course {$courseid}",
                409 // HTTP 409 Conflict
            );
        }

        // Step 7: Validate and determine role ID
        if ($roleid === null) {
            // Default to student role - get from role archetype
            $studentroles = get_archetype_roles('student');
            if (empty($studentroles)) {
                throw new ValidationException('Student role archetype not found in system');
            }
            $studentrole = reset($studentroles); // Get first student role
            $roleid = $studentrole->id;
        } else {
            // Validate that specified role exists
            $role = $DB->get_record('role', ['id' => $roleid], 'id, shortname', IGNORE_MISSING);
            if (!$role) {
                throw new ValidationException("Role with ID {$roleid} does not exist");
            }
            
            // Check if user has permission to assign this role
            if (!$isselfenroll) {
                // When enrolling others, verify permission to assign the specified role
                $assignableroles = get_assignable_roles($coursecontext, ROLENAME_SHORT, false, $authuser->id);
                if (!array_key_exists($roleid, $assignableroles)) {
                    throw new ForbiddenException(
                        "You do not have permission to assign role '{$role->shortname}' in this course"
                    );
                }
            }
        }

        // Validate time parameters
        if ($timestart < 0) {
            throw new ValidationException('Enrollment start time cannot be negative');
        }
        
        if ($timeend < 0) {
            throw new ValidationException('Enrollment end time cannot be negative');
        }
        
        if ($timeend > 0 && $timestart > 0 && $timeend < $timestart) {
            throw new ValidationException(
                'Enrollment end time cannot be before start time'
            );
        }

        // Step 8: Execute enrollment using core Moodle function
        // enrol_try_internal_enrol() handles:
        // - Finding or creating manual enrollment instance
        // - Creating user_enrolments record
        // - Assigning role to user in course context
        // - Triggering user_enrolment_created event
        // - Sending enrollment notifications
        try {
            enrol_try_internal_enrol($courseid, $userid, $roleid, $timestart, $timeend);
        } catch (Exception $e) {
            // Log the enrollment failure for security auditing
            if (function_exists('add_to_log')) {
                add_to_log(
                    $courseid,
                    'course',
                    'enrol_failed',
                    "view.php?id={$courseid}",
                    "Failed to enroll user {$userid}: " . $e->getMessage(),
                    0,
                    $authuser->id
                );
            }
            
            throw new ValidationException(
                "Enrollment failed: " . $e->getMessage()
            );
        }

        // Log successful enrollment for security auditing and compliance
        if (function_exists('add_to_log')) {
            add_to_log(
                $courseid,
                'course',
                'enrol',
                "view.php?id={$courseid}",
                "User {$userid} enrolled in course {$courseid} with role {$roleid}",
                0,
                $authuser->id
            );
        }

        // Step 9: Retrieve the created enrollment record to return complete data
        $enrolinstances = enrol_get_instances($courseid, true);
        $manualinstance = null;
        
        foreach ($enrolinstances as $instance) {
            if ($instance->enrol === 'manual') {
                $manualinstance = $instance;
                break;
            }
        }

        $userenrolment = null;
        if ($manualinstance) {
            $userenrolment = $DB->get_record('user_enrolments', [
                'enrolid' => $manualinstance->id,
                'userid' => $userid
            ], 'id, userid, enrolid, timecreated, timestart, timeend');
        }

        // Prepare enrollment data for response
        $enrollmentdata = [
            'courseid' => $courseid,
            'userid' => $userid,
            'roleid' => $roleid,
            'timeenrolled' => $userenrolment ? $userenrolment->timecreated : time(),
            'timestart' => $timestart,
            'timeend' => $timeend
        ];

        // Return standardized success response with 201 Created status
        $this->success(['enrollment' => $enrollmentdata], 201);
    }
}

// Instantiate and execute endpoint when not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new CourseEnrollEndpoint();
    $endpoint->execute();
}

