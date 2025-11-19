<?php
/**
 * Course Enrollment API Endpoint
 *
 * POST /api/v1/courses/{id}/enroll - Enroll user(s) in a course
 *
 * This endpoint provides the ability to enroll users into courses.
 * It wraps the existing Moodle enrollment functionality without
 * duplicating any business logic.
 *
 * @package    api
 * @subpackage v1
 * @copyright  2024 Moodle React Migration
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include required files
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/moodlelib.php');
require_once($CFG->dirroot . '/lib/enrollib.php');
require_once($CFG->dirroot . '/enrol/manual/externallib.php');
require_once($CFG->dirroot . '/api/lib/api_base.php');
require_once($CFG->dirroot . '/api/lib/api_exception.php');

/**
 * Course Enrollment Endpoint Handler
 *
 * Handles POST requests to enroll users into a course.
 * Delegates all business logic to existing Moodle core functions:
 * - enrol_try_internal_enrol() for simple enrollment
 * - enrol_manual_external::enrol_users() for complex scenarios
 *
 * URL Parameters:
 * - id: Course ID (required, from URL path)
 *
 * POST Parameters:
 * - userid: User ID to enroll (optional, defaults to authenticated user)
 * - userids: Array of user IDs to enroll (optional, for bulk enrollment)
 * - roleid: Role ID to assign (optional, defaults to student role)
 * - timestart: Enrollment start time (optional, Unix timestamp)
 * - timeend: Enrollment end time (optional, Unix timestamp)
 * - suspend: Suspend enrollment (optional, 0 or 1)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "message": "User(s) enrolled successfully",
 *     "enrollments": [
 *       {"userid": 123, "roleid": 5, "status": "success"},
 *       ...
 *     ]
 *   }
 * }
 */
class CoursesEnrollEndpoint extends ApiBase {
    
    /**
     * Handle POST requests to enroll users in a course.
     *
     * This method:
     * 1. Validates JWT token and extracts authenticated user
     * 2. Extracts and validates course ID from URL path
     * 3. Verifies course exists and user has permission to enroll users
     * 4. Extracts enrollment parameters (user IDs, role, dates)
     * 5. Calls existing Moodle enrollment functions
     * 6. Returns standardized JSON response with enrollment results
     *
     * @return void Outputs JSON response and exits
     * @throws ApiException If validation fails or user lacks permissions
     */
    protected function handle_post() {
        global $CFG, $DB;

        try {
            // Get authenticated user from JWT token.
            $user = $this->getUser();
            if (!$user) {
                throw new UnauthorizedException('Authentication required');
            }

            // Extract and validate course ID from URL path parameter.
            $courseid = $this->getParam('id', PARAM_INT, true);

            // Validate that courseid is positive.
            if ($courseid <= 0) {
                throw new ValidationException('Invalid course ID');
            }

            // Verify the course exists.
            try {
                $course = get_course($courseid);
            } catch (dml_missing_record_exception $e) {
                throw new NotFoundException('Course not found');
            }

            // Check if user has permission to enroll users in the course.
            $coursecontext = context_course::instance($courseid);
            $this->checkCapability('moodle/course:enrol', $coursecontext);

            // Extract enrollment parameters from POST body.
            $userid = $this->getParam('userid', PARAM_INT, false, null);
            $userids = $this->getParam('userids', PARAM_SEQUENCE, false, null);
            $roleid = $this->getParam('roleid', PARAM_INT, false, null);
            $timestart = $this->getParam('timestart', PARAM_INT, false, 0);
            $timeend = $this->getParam('timeend', PARAM_INT, false, 0);
            $suspend = $this->getParam('suspend', PARAM_INT, false, 0);

            // Determine which users to enroll.
            $userstoenroll = [];
            
            if (!empty($userids)) {
                // Bulk enrollment: parse comma-separated user IDs.
                $userstoenroll = explode(',', $userids);
                $userstoenroll = array_map('intval', $userstoenroll);
                $userstoenroll = array_filter($userstoenroll, function($id) {
                    return $id > 0;
                });
            } else if (!empty($userid)) {
                // Single user enrollment.
                $userstoenroll = [(int)$userid];
            } else {
                // Default: enroll the authenticated user (self-enrollment).
                $userstoenroll = [(int)$user->id];
            }

            if (empty($userstoenroll)) {
                throw new ValidationException('No valid user IDs provided for enrollment');
            }

            // Validate all users exist.
            foreach ($userstoenroll as $enrolluserid) {
                if (!$DB->record_exists('user', ['id' => $enrolluserid, 'deleted' => 0])) {
                    throw new ValidationException("User with ID {$enrolluserid} not found");
                }
            }

            // Determine the role to assign.
            if ($roleid === null) {
                // Default to student role if not specified.
                $studentrole = $DB->get_record('role', ['shortname' => 'student']);
                if (!$studentrole) {
                    throw new ServerException('Student role not found in system');
                }
                $roleid = $studentrole->id;
            } else {
                // Validate that the specified role exists.
                if (!$DB->record_exists('role', ['id' => $roleid])) {
                    throw new ValidationException('Invalid role ID');
                }
            }

            // Validate time parameters.
            if ($timeend > 0 && $timestart > 0 && $timeend < $timestart) {
                throw new ValidationException('End time cannot be before start time');
            }

            // Validate suspend parameter.
            if (!in_array($suspend, [0, 1], true)) {
                throw new ValidationException('Suspend must be 0 or 1');
            }

            // Get the manual enrollment plugin instance for this course.
            $enrolinstances = enrol_get_instances($courseid, true);
            $manualinstance = null;
            
            foreach ($enrolinstances as $instance) {
                if ($instance->enrol === 'manual') {
                    $manualinstance = $instance;
                    break;
                }
            }

            // If no manual enrollment instance exists, create one.
            if (!$manualinstance) {
                $manualplugin = enrol_get_plugin('manual');
                if (!$manualplugin) {
                    throw new ServerException('Manual enrollment plugin not available');
                }
                $instanceid = $manualplugin->add_default_instance($course);
                if (!$instanceid) {
                    throw new ServerException('Failed to create enrollment instance');
                }
                $manualinstance = $DB->get_record('enrol', ['id' => $instanceid]);
            }

            // Perform enrollments and collect results.
            $enrollmentresults = [];
            $successcount = 0;
            $errorcount = 0;

            foreach ($userstoenroll as $enrolluserid) {
                try {
                    // Check if user is already enrolled.
                    $isenrolled = is_enrolled($coursecontext, $enrolluserid);
                    
                    if ($isenrolled) {
                        // User already enrolled, update role assignment if needed.
                        role_assign($roleid, $enrolluserid, $coursecontext->id, 'enrol_manual', $manualinstance->id);
                        
                        $enrollmentresults[] = [
                            'userid' => $enrolluserid,
                            'roleid' => $roleid,
                            'status' => 'already_enrolled',
                            'message' => 'User was already enrolled, role assignment updated'
                        ];
                        $successcount++;
                    } else {
                        // Enroll the user using core Moodle function.
                        // This function handles all validation, database operations, and event triggering.
                        enrol_try_internal_enrol(
                            $courseid,
                            $enrolluserid,
                            $roleid,
                            $timestart,
                            $timeend
                        );

                        // If suspend flag is set, update the user enrollment status.
                        if ($suspend == 1) {
                            $manualplugin = enrol_get_plugin('manual');
                            $userenrolment = $DB->get_record('user_enrolments', [
                                'enrolid' => $manualinstance->id,
                                'userid' => $enrolluserid
                            ]);
                            if ($userenrolment) {
                                $manualplugin->update_user_enrol($manualinstance, $enrolluserid, ENROL_USER_SUSPENDED);
                            }
                        }

                        $enrollmentresults[] = [
                            'userid' => $enrolluserid,
                            'roleid' => $roleid,
                            'status' => 'success',
                            'message' => 'User enrolled successfully'
                        ];
                        $successcount++;
                    }
                } catch (Exception $e) {
                    // Individual enrollment failed, record error but continue with others.
                    $enrollmentresults[] = [
                        'userid' => $enrolluserid,
                        'status' => 'error',
                        'message' => $e->getMessage()
                    ];
                    $errorcount++;
                }
            }

            // Prepare response data.
            $responsedata = [
                'message' => sprintf(
                    'Enrollment complete: %d successful, %d failed',
                    $successcount,
                    $errorcount
                ),
                'courseid' => $courseid,
                'total' => count($userstoenroll),
                'successful' => $successcount,
                'failed' => $errorcount,
                'enrollments' => $enrollmentresults
            ];

            // Return standardized success response with enrollment results.
            // HTTP 200 OK if all succeeded, 207 Multi-Status if some failed.
            $statuscode = ($errorcount > 0) ? 207 : 200;
            $this->success($responsedata, $statuscode);

        } catch (moodle_exception $e) {
            // Handle Moodle-specific exceptions.
            if (strpos($e->getMessage(), 'nopermission') !== false) {
                throw new ForbiddenException('You do not have permission to enroll users in this course');
            } else if (strpos($e->getMessage(), 'invalidrecord') !== false ||
                       strpos($e->getMessage(), 'notfound') !== false) {
                throw new NotFoundException('Course or user not found');
            } else if (strpos($e->getMessage(), 'enrolnotpermitted') !== false) {
                throw new ValidationException('Enrollment not permitted: ' . $e->getMessage());
            } else {
                // Generic server error for unexpected Moodle exceptions.
                throw new ServerException('Failed to enroll user(s): ' . $e->getMessage());
            }
        }
    }

    /**
     * Handle GET requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for enrollment');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for enrollment');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for enrollment');
    }
}

// Instantiate endpoint and execute request handling.

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new CoursesEnrollEndpoint();
    $endpoint->execute();
}
