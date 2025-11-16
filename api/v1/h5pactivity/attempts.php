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
 * REST API endpoint for retrieving H5P activity attempts.
 *
 * GET /api/v1/h5pactivity/{id}/attempts
 *
 * Returns list of user attempts for an H5P activity with scores, completion
 * status, and xAPI statement data. Validates JWT token and enforces capability
 * checking (mod/h5pactivity:reviewattempts for teachers, or own attempts for students).
 *
 * Request Parameters:
 * - id (required): H5P activity ID in URL path
 * - userid (optional): User ID to retrieve attempts for (defaults to authenticated user)
 * - page (optional): Page number for pagination (default: 0)
 * - perpage (optional): Items per page (default: 20)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "activityid": 123,
 *     "usersattempts": [
 *       {
 *         "userid": 456,
 *         "attempts": [
 *           {
 *             "id": 789,
 *             "h5pactivityid": 123,
 *             "userid": 456,
 *             "timecreated": 1234567890,
 *             "timemodified": 1234567890,
 *             "attempt": 1,
 *             "rawscore": 85,
 *             "maxscore": 100,
 *             "duration": 300,
 *             "completion": 1,
 *             "success": 1,
 *             "scaled": 0.85
 *           }
 *         ],
 *         "scored": {
 *           "title": "Highest grade",
 *           "grademethod": "highest",
 *           "attempts": [...]
 *         }
 *       }
 *     ],
 *     "warnings": []
 *   },
 *   "meta": {
 *     "pagination": {
 *       "page": 0,
 *       "perpage": 20,
 *       "total": 5
 *     }
 *   }
 * }
 *
 * @package    api
 * @subpackage h5pactivity
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/moodlelib.php');
require_once($CFG->dirroot . '/mod/h5pactivity/lib.php');

// Load API base classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');
require_once(__DIR__ . '/../../lib/api_response.php');

// Load H5P activity classes
use mod_h5pactivity\local\manager;
use mod_h5pactivity\local\attempt;
use mod_h5pactivity\local\report\attempts as report_attempts;

/**
 * H5P Activity Attempts API endpoint.
 *
 * Handles retrieval of user attempts for H5P activities, including attempt
 * details, scores, completion status, and xAPI statement references.
 */
class H5PActivityAttemptsEndpoint extends ApiBase {
    
    /**
     * Handle GET request for H5P activity attempts.
     *
     * Retrieves attempts for the specified H5P activity and user(s).
     * Teachers with mod/h5pactivity:reviewattempts can view all user attempts.
     * Students can only view their own attempts.
     *
     * @return void Outputs JSON response
     * @throws NotFoundException If H5P activity not found
     * @throws ForbiddenException If user lacks required capability
     */
    protected function handle_get() {
        global $DB;
        
        try {
            // Get authenticated user
            $user = $this->getUser();
            
            // Extract H5P activity ID from URL path
            // URL format: /api/v1/h5pactivity/{id}/attempts
            $urlParts = explode('/', trim($this->requestUri, '/'));
            $h5pactivityid = null;
            
            // Find the ID in the URL (should be after 'h5pactivity')
            foreach ($urlParts as $i => $part) {
                if ($part === 'h5pactivity' && isset($urlParts[$i + 1])) {
                    $h5pactivityid = clean_param($urlParts[$i + 1], PARAM_INT);
                    break;
                }
            }
            
            if (!$h5pactivityid) {
                throw new ValidationException('Missing H5P activity ID', [
                    'parameter' => 'id',
                    'reason' => 'H5P activity ID must be provided in URL path'
                ]);
            }
            
            // Get optional parameters
            $userid = $this->getParam('userid', PARAM_INT, false, null);
            $page = $this->getParam('page', PARAM_INT, false, 0);
            $perpage = $this->getParam('perpage', PARAM_INT, false, 20);
            
            // Validate pagination parameters
            if ($page < 0) {
                throw new ValidationException('Invalid page parameter', [
                    'parameter' => 'page',
                    'value' => $page,
                    'reason' => 'Page must be >= 0'
                ]);
            }
            
            if ($perpage < 1 || $perpage > 100) {
                throw new ValidationException('Invalid perpage parameter', [
                    'parameter' => 'perpage',
                    'value' => $perpage,
                    'reason' => 'Items per page must be between 1 and 100'
                ]);
            }
            
            // Get course and course module from H5P activity instance
            try {
                list($course, $cm) = get_course_and_cm_from_instance($h5pactivityid, 'h5pactivity');
            } catch (moodle_exception $e) {
                throw new NotFoundException('H5P activity not found', [
                    'h5pactivityid' => $h5pactivityid,
                    'reason' => 'No H5P activity exists with this ID or you do not have access'
                ]);
            }
            
            // Get module context
            $context = context_module::instance($cm->id);
            
            // Create H5P activity manager
            $manager = manager::create_from_coursemodule($cm);
            $instance = $manager->get_instance();
            
            // Determine if user can view all attempts or only their own
            $canViewAll = $manager->can_view_all_attempts();
            
            // If no userid specified, default to authenticated user
            if ($userid === null) {
                $userid = $user->id;
            }
            
            // If requesting another user's attempts, verify capability
            if ($userid != $user->id && !$canViewAll) {
                throw new ForbiddenException('Cannot view other users\' attempts', [
                    'capability' => 'mod/h5pactivity:reviewattempts',
                    'reason' => 'You can only view your own attempts unless you have the reviewattempts capability'
                ]);
            }
            
            // Initialize result arrays
            $usersattempts = [];
            $warnings = [];
            
            // Build list of user IDs to retrieve attempts for
            if ($canViewAll && $userid === null) {
                // Teacher viewing all users - get enrolled users
                $userids = $this->getEnrolledUserIds($context, $page, $perpage);
            } else {
                // Specific user or student viewing own attempts
                $userids = [$userid];
            }
            
            // Retrieve attempts for each user
            foreach ($userids as $targetuserid) {
                // Get report for this user
                $report = $manager->get_report($targetuserid);
                
                if ($report && $report instanceof report_attempts) {
                    // Export user attempts data
                    $usersattempts[] = $this->exportUserAttempts($report, $targetuserid);
                } else {
                    // Add warning if cannot access user's attempts
                    $warnings[] = [
                        'item' => 'user',
                        'itemid' => $targetuserid,
                        'warningcode' => '1',
                        'message' => 'Cannot access user attempts'
                    ];
                }
            }
            
            // Count total attempts for pagination metadata
            $totalAttempts = $manager->count_attempts();
            
            // Build response data
            $responseData = [
                'activityid' => $instance->id,
                'usersattempts' => $usersattempts,
                'warnings' => $warnings
            ];
            
            // Add pagination metadata
            $meta = [
                'pagination' => [
                    'page' => $page,
                    'perpage' => $perpage,
                    'total' => $totalAttempts
                ]
            ];
            
            // Send success response
            $this->success($responseData, 200, $meta);
            
        } catch (ApiException $e) {
            // Re-throw API exceptions to be handled by parent
            throw $e;
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to API exceptions
            if ($e->errorcode === 'nopermissions' || $e->errorcode === 'nopermissiontoviewattempts') {
                throw new ForbiddenException($e->getMessage(), [
                    'errorcode' => $e->errorcode,
                    'capability' => 'mod/h5pactivity:reviewattempts'
                ]);
            }
            
            throw new ServerException('Error retrieving H5P activity attempts', [
                'originalError' => $e->getMessage(),
                'errorcode' => $e->errorcode
            ]);
            
        } catch (Exception $e) {
            // Catch unexpected exceptions
            throw new ServerException('Internal server error', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
        }
    }
    
    /**
     * Export attempts data for a specific user.
     *
     * Formats the user's attempts data into the API response structure,
     * including all attempts and scored attempt information.
     *
     * @param report_attempts $report The report attempts object
     * @param int $userid The user ID
     * @return array Formatted user attempts data
     */
    private function exportUserAttempts(report_attempts $report, int $userid): array {
        // Get scored attempt (the one used for grading)
        $scored = $report->get_scored();
        
        // Get all attempts
        $attempts = $report->get_attempts();
        
        // Build result structure
        $result = [
            'userid' => $userid,
            'attempts' => []
        ];
        
        // Export each attempt
        foreach ($attempts as $attempt) {
            $result['attempts'][] = $this->exportAttempt($attempt);
        }
        
        // Add scored attempt information if available
        if (!empty($scored)) {
            $result['scored'] = [
                'title' => $scored->title,
                'grademethod' => $scored->grademethod,
                'attempts' => [$this->exportAttempt($scored->attempt)]
            ];
        }
        
        return $result;
    }
    
    /**
     * Export a single attempt to API response format.
     *
     * Converts an attempt object to an array with all relevant fields
     * including scores, timestamps, completion, and success status.
     *
     * @param attempt $attempt The attempt object
     * @return array Formatted attempt data
     */
    private function exportAttempt(attempt $attempt): array {
        // Build base attempt data
        $result = [
            'id' => $attempt->get_id(),
            'h5pactivityid' => $attempt->get_h5pactivityid(),
            'userid' => $attempt->get_userid(),
            'timecreated' => $attempt->get_timecreated(),
            'timemodified' => $attempt->get_timemodified(),
            'attempt' => $attempt->get_attempt(),
            'rawscore' => $attempt->get_rawscore(),
            'maxscore' => $attempt->get_maxscore(),
            'duration' => $attempt->get_duration(),
            'scaled' => $attempt->get_scaled()
        ];
        
        // Add optional completion status if available
        if ($attempt->get_completion() !== null) {
            $result['completion'] = $attempt->get_completion();
        }
        
        // Add optional success status if available
        if ($attempt->get_success() !== null) {
            $result['success'] = $attempt->get_success();
        }
        
        return $result;
    }
    
    /**
     * Get IDs of enrolled users with access to the H5P activity.
     *
     * Retrieves user IDs for users who are enrolled in the course and
     * have access to view the H5P activity module.
     *
     * @param context_module $context The module context
     * @param int $page Page number for pagination
     * @param int $perpage Items per page
     * @return array Array of user IDs
     */
    private function getEnrolledUserIds($context, int $page = 0, int $perpage = 20): array {
        global $DB;
        
        // Get enrolled users with capability to view the module
        $enrolledUsers = get_enrolled_users(
            $context,
            'mod/h5pactivity:view',
            0,  // All groups
            'u.id',
            null,
            $page * $perpage,
            $perpage
        );
        
        // Extract user IDs
        return array_keys($enrolledUsers);
    }
    
    /**
     * Handle POST request - not supported.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT request - not supported.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE request - not supported.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new H5PActivityAttemptsEndpoint();
$endpoint->execute();
